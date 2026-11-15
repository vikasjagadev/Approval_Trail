import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { comparePassword } from '../utils/hash.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { generateToken, requireAuth, toPublicUser } from '../middleware/auth.js';
import { auditService } from '../services/auditService.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Too many login attempts. Please try again after a minute.',
      details: [],
    },
  },
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post(
  '/auth/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { manager: true },
    });

    if (!user || !user.active) {
      throw AppError.unauthenticated('Invalid email or password');
    }

    const matches = await comparePassword(password, user.passwordHash);
    if (!matches) {
      throw AppError.unauthenticated('Invalid email or password');
    }

    const token = generateToken(user);

    // Record audit log for login
    await auditService.record(prisma, {
      actor: { id: user.id, name: user.name },
      action: 'USER_LOGIN',
      details: { email: user.email, role: user.role },
    });

    res.json({
      token,
      user: toPublicUser(user),
    });
  })
);

router.get(
  '/auth/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { manager: true },
    });

    if (!user) {
      throw AppError.unauthenticated('User not found');
    }

    res.json({
      user: toPublicUser(user),
    });
  })
);

export default router;

