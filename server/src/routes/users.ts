import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError } from '../utils/errors.js';
import { hashPassword } from '../utils/hash.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, toPublicUser } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { auditService } from '../services/auditService.js';

const router = Router();

// Approvers dropdown list: any authenticated user
router.get(
  '/users/approvers',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const approvers = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(approvers);
  })
);

// List users: ADMIN only
router.get(
  '/users',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users.map(toPublicUser));
  })
);

const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'APPROVER', 'REQUESTER']),
  managerId: z.string().optional().nullable(),
});

// Create user: ADMIN only
router.post(
  '/users',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    const { name, email, password, role, managerId } = req.body;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw AppError.conflict('A user with this email address already exists');
    }

    if (managerId) {
      const manager = await prisma.user.findUnique({ where: { id: managerId } });
      if (!manager) {
        throw AppError.validationError('Specified manager does not exist');
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash,
          role,
          managerId: managerId || null,
        },
        include: { manager: true },
      });

      await auditService.record(tx, {
        actor: { id: req.user!.id, name: req.user!.name },
        action: 'USER_CREATED',
        details: { userId: newUser.id, email: newUser.email, role: newUser.role },
      });

      return newUser;
    });

    res.status(201).json(toPublicUser(user));
  })
);

const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'APPROVER', 'REQUESTER']).optional(),
  managerId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

// Update user: ADMIN only
router.patch(
  '/users/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, role, managerId, active } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (managerId && managerId === id) {
      throw AppError.validationError('A user cannot be their own manager');
    }

    if (managerId) {
      const manager = await prisma.user.findUnique({ where: { id: managerId } });
      if (!manager) {
        throw AppError.validationError('Specified manager does not exist');
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: {
          name: name !== undefined ? name : user.name,
          role: role !== undefined ? role : user.role,
          managerId: managerId !== undefined ? managerId : user.managerId,
          active: active !== undefined ? active : user.active,
        },
        include: { manager: true },
      });

      await auditService.record(tx, {
        actor: { id: req.user!.id, name: req.user!.name },
        action: 'USER_UPDATED',
        details: {
          userId: result.id,
          changes: { name, role, managerId, active },
        },
      });

      return result;
    });

    res.json(toPublicUser(updated));
  })
);

export default router;

