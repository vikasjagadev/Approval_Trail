import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { auditService } from '../services/auditService.js';

const router = Router();

function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);
  // Prevent CSV injection: prefix =, +, -, @ with '
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  // Escape double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

const auditQuerySchema = z.object({
  requestId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

function buildAuditWhere(query: z.infer<typeof auditQuerySchema>): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (query.requestId) {
    where.requestId = query.requestId;
  }
  if (query.actorId) {
    where.actorId = query.actorId;
  }
  if (query.action) {
    where.action = query.action;
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) {
      where.createdAt.gte = new Date(query.from);
    }
    if (query.to) {
      where.createdAt.lte = new Date(query.to);
    }
  }

  return where;
}

// Global audit log: ADMIN and MANAGER
router.get(
  '/audit',
  requireAuth,
  requireRole('ADMIN', 'MANAGER'),
  validate({ query: auditQuerySchema }),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Math.min(200, Number(req.query.pageSize || 20)));
    const skip = (page - 1) * pageSize;

    const where = buildAuditWhere(req.query);

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { seq: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const formattedItems = items.map((item) => {
      let parsedDetails: unknown = item.details;
      try {
        parsedDetails = JSON.parse(item.details);
      } catch {
        // keep string
      }
      return {
        ...item,
        details: parsedDetails,
      };
    });

    res.json({
      items: formattedItems,
      total,
      page,
      pageSize,
    });
  })
);

// Verify hash chain: ADMIN only
router.get(
  '/audit/verify',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const result = await auditService.verifyChain();
    res.json(result);
  })
);

// CSV Export: ADMIN only
router.get(
  '/audit/export.csv',
  requireAuth,
  requireRole('ADMIN'),
  validate({ query: auditQuerySchema }),
  asyncHandler(async (req, res) => {
    const where = buildAuditWhere(req.query);

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { seq: 'asc' },
    });

    const headers = ['Seq', 'Timestamp', 'Request ID', 'Actor ID', 'Actor Name', 'Action', 'Details', 'Prev Hash', 'Hash'];
    const rows = logs.map((log) => [
      sanitizeCsvCell(log.seq),
      sanitizeCsvCell(log.createdAt.toISOString()),
      sanitizeCsvCell(log.requestId || ''),
      sanitizeCsvCell(log.actorId || ''),
      sanitizeCsvCell(log.actorName),
      sanitizeCsvCell(log.action),
      sanitizeCsvCell(log.details),
      sanitizeCsvCell(log.prevHash),
      sanitizeCsvCell(log.hash),
    ]);

    const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
    res.send(csvContent);
  })
);

export default router;

