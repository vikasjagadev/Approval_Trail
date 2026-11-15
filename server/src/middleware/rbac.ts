import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthenticated());
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(AppError.forbidden(`Access forbidden for role ${req.user.role}`));
      return;
    }

    next();
  };
}

