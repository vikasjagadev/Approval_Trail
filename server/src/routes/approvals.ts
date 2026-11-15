import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requestService } from '../services/requestService.js';
import { workflowEngine } from '../services/workflowEngine.js';

const router = Router();

// Approver inbox
router.get(
  '/approvals/inbox',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await requestService.getInboxRequests(req.user!);
    res.json(items);
  })
);

const decideSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES']),
  comment: z.string().optional(),
});

// Approver decision
router.post(
  '/approvals/:requestId/decide',
  requireAuth,
  validate({ body: decideSchema }),
  asyncHandler(async (req, res) => {
    const decided = await prisma.$transaction(async (tx) => {
      return workflowEngine.decideStep(tx, req.params.requestId, req.user!, req.body);
    });

    res.json(decided);
  })
);

export default router;

