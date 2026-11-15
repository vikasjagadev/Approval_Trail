import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requestService } from '../services/requestService.js';
import { workflowEngine } from '../services/workflowEngine.js';

const router = Router();

// List requests
const listRequestsQuerySchema = z.object({
  scope: z.enum(['mine', 'all']).optional(),
  status: z.string().optional(),
  typeId: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

router.get(
  '/requests',
  requireAuth,
  validate({ query: listRequestsQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await requestService.listRequests(req.user!, {
      scope: req.query.scope as 'mine' | 'all' | undefined,
      status: req.query.status as string | undefined,
      typeId: req.query.typeId as string | undefined,
      q: req.query.q as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });

    res.json(result);
  })
);

// Create DRAFT request
const createRequestSchema = z.object({
  requestTypeId: z.string().min(1, 'Request type is required'),
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  data: z.record(z.unknown()),
});

router.post(
  '/requests',
  requireAuth,
  validate({ body: createRequestSchema }),
  asyncHandler(async (req, res) => {
    const request = await requestService.createDraft(req.user!, req.body);
    res.status(201).json(request);
  })
);

// Get single request detail
router.get(
  '/requests/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const detail = await requestService.getRequestDetail(req.params.id, req.user!);
    res.json(detail);
  })
);

// Update DRAFT or CHANGES_REQUESTED request
const updateRequestSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').optional(),
  data: z.record(z.unknown()).optional(),
});

router.put(
  '/requests/:id',
  requireAuth,
  validate({ body: updateRequestSchema }),
  asyncHandler(async (req, res) => {
    const updated = await requestService.updateRequest(req.params.id, req.user!, req.body);
    res.json(updated);
  })
);

// Submit DRAFT to PENDING
router.post(
  '/requests/:id/submit',
  requireAuth,
  asyncHandler(async (req, res) => {
    const submitted = await prisma.$transaction(async (tx) => {
      return workflowEngine.submitRequest(tx, req.params.id, req.user!);
    });
    res.json(submitted);
  })
);

// Resubmit CHANGES_REQUESTED to PENDING
const resubmitSchema = z.object({
  data: z.record(z.unknown()).optional(),
});

router.post(
  '/requests/:id/resubmit',
  requireAuth,
  validate({ body: resubmitSchema }),
  asyncHandler(async (req, res) => {
    const resubmitted = await prisma.$transaction(async (tx) => {
      return workflowEngine.resubmitRequest(tx, req.params.id, req.user!, req.body?.data);
    });
    res.json(resubmitted);
  })
);

// Cancel request
const cancelSchema = z.object({
  comment: z.string().optional(),
});

router.post(
  '/requests/:id/cancel',
  requireAuth,
  validate({ body: cancelSchema }),
  asyncHandler(async (req, res) => {
    const cancelled = await prisma.$transaction(async (tx) => {
      return workflowEngine.cancelRequest(tx, req.params.id, req.user!, req.body?.comment);
    });
    res.json(cancelled);
  })
);

// Add comment
const addCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment body is required'),
});

router.post(
  '/requests/:id/comments',
  requireAuth,
  validate({ body: addCommentSchema }),
  asyncHandler(async (req, res) => {
    const comment = await requestService.addComment(req.params.id, req.user!, req.body.body);
    res.status(201).json(comment);
  })
);

export default router;

