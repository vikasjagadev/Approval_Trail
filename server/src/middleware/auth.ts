import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { AppError } from '../utils/errors.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  managerId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JwtTokenPayload {
  sub: string;
  role: string;
}

export function generateToken(user: { id: string; role: string }): string {
  return jwt.sign({ sub: user.id, role: user.role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(AppError.unauthenticated('Authorization header missing or invalid'));
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtTokenPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || !user.active) {
      next(AppError.unauthenticated('User not found or deactivated'));
      return;
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      managerId: user.managerId,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      next(AppError.unauthenticated('Invalid or expired token'));
      return;
    }
    next(err);
  }
}

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  managerId: string | null;
  active: boolean;
  createdAt: Date;
  manager?: { id: string; name: string; email: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    managerId: user.managerId,
    manager: user.manager
      ? {
          id: user.manager.id,
          name: user.manager.name,
          email: user.manager.email,
        }
      : null,
    active: user.active,
    createdAt: user.createdAt,
  };
}

