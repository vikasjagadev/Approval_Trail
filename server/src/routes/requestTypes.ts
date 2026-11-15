import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { auditService } from '../services/auditService.js';
import { FormField } from '../services/formValidator.js';

const router = Router();

function formatRequestType(rt: {
  id: string;
  key: string;
  name: string;
  description: string;
  formSchema: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  steps: {
    id: string;
    requestTypeId: string;
    order: number;
    name: string;
    approverKind: string;
    approverRole: string | null;
    approverUserId: string | null;
    condition: string | null;
  }[];
}) {
  let parsedFormSchema: FormField[] = [];
  try {
    parsedFormSchema = JSON.parse(rt.formSchema);
  } catch {
    parsedFormSchema = [];
  }

  const parsedSteps = rt.steps.map((s) => ({
    ...s,
    conditionParsed: s.condition ? JSON.parse(s.condition) : null,
  }));

  return {
    ...rt,
    formSchema: parsedFormSchema,
    steps: parsedSteps,
  };
}

// List request types
router.get(
  '/request-types',
  requireAuth,
  asyncHandler(async (req, res) => {
    const showAll = req.query.all === '1' && req.user!.role === 'ADMIN';

    const requestTypes = await prisma.requestType.findMany({
      where: showAll ? undefined : { active: true },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(requestTypes.map(formatRequestType));
  })
);

// Get single request type
router.get(
  '/request-types/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rt = await prisma.requestType.findUnique({
      where: { id: req.params.id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!rt) {
      throw AppError.notFound('Request type not found');
    }

    res.json(formatRequestType(rt));
  })
);

const formFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['text', 'textarea', 'number', 'date', 'select', 'checkbox']),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  placeholder: z.string().optional(),
});

const workflowStepInputSchema = z.object({
  order: z.number().int().min(1),
  name: z.string().min(1, 'Step name is required'),
  approverKind: z.enum(['ROLE', 'USER', 'REQUESTER_MANAGER']),
  approverRole: z.string().nullable().optional(),
  approverUserId: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
});

const createRequestTypeSchema = z.object({
  key: z.string().trim().toUpperCase().min(2, 'Key must be at least 2 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().default(''),
  formSchema: z.array(formFieldSchema).min(1, 'At least one form field is required'),
  steps: z.array(workflowStepInputSchema).min(1, 'At least one workflow step is required'),
  active: z.boolean().default(true),
});

// Create request type: ADMIN only
router.post(
  '/request-types',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createRequestTypeSchema }),
  asyncHandler(async (req, res) => {
    const { key, name, description, formSchema, steps, active } = req.body;

    const existing = await prisma.requestType.findUnique({ where: { key } });
    if (existing) {
      throw AppError.conflict(`Request type with key '${key}' already exists`);
    }

    if (active && steps.length === 0) {
      throw AppError.validationError('A request type must have at least one step before it can be activated');
    }

    const created = await prisma.$transaction(async (tx) => {
      const rt = await tx.requestType.create({
        data: {
          key,
          name,
          description: description || '',
          formSchema: JSON.stringify(formSchema),
          active,
          steps: {
            create: steps.map((s: {
              order: number;
              name: string;
              approverKind: string;
              approverRole?: string | null;
              approverUserId?: string | null;
              condition?: string | null;
            }) => ({
              order: s.order,
              name: s.name,
              approverKind: s.approverKind,
              approverRole: s.approverRole || null,
              approverUserId: s.approverUserId || null,
              condition: s.condition || null,
            })),
          },
        },
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      });

      await auditService.record(tx, {
        actor: { id: req.user!.id, name: req.user!.name },
        action: 'REQUEST_TYPE_CREATED',
        details: { key: rt.key, name: rt.name, stepsCount: rt.steps.length },
      });

      return rt;
    });

    res.status(201).json(formatRequestType(created));
  })
);

const updateRequestTypeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().default(''),
  formSchema: z.array(formFieldSchema).min(1, 'At least one form field is required'),
  steps: z.array(workflowStepInputSchema).min(1, 'At least one workflow step is required'),
  active: z.boolean(),
});

// Replace request type: ADMIN only
router.put(
  '/request-types/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateRequestTypeSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, formSchema, steps, active } = req.body;

    const existing = await prisma.requestType.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!existing) {
      throw AppError.notFound('Request type not found');
    }

    if (active && steps.length === 0) {
      throw AppError.validationError('A request type must have at least one step before it can be activated');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Delete existing workflow steps and recreate
      await tx.workflowStep.deleteMany({
        where: { requestTypeId: id },
      });

      const rt = await tx.requestType.update({
        where: { id },
        data: {
          name,
          description: description || '',
          formSchema: JSON.stringify(formSchema),
          active,
          steps: {
            create: steps.map((s: {
              order: number;
              name: string;
              approverKind: string;
              approverRole?: string | null;
              approverUserId?: string | null;
              condition?: string | null;
            }) => ({
              order: s.order,
              name: s.name,
              approverKind: s.approverKind,
              approverRole: s.approverRole || null,
              approverUserId: s.approverUserId || null,
              condition: s.condition || null,
            })),
          },
        },
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      });

      await auditService.record(tx, {
        actor: { id: req.user!.id, name: req.user!.name },
        action: 'REQUEST_TYPE_UPDATED',
        details: { key: rt.key, name: rt.name, active: rt.active, stepsCount: rt.steps.length },
      });

      return rt;
    });

    res.json(formatRequestType(updated));
  })
);

export default router;

