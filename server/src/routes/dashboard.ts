import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requestService } from '../services/requestService.js';

const router = Router();

router.get(
  '/dashboard/stats',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Counts by status for the current user's requests
    const userRequests = await prisma.request.findMany({
      where: { requesterId: user.id },
      select: { status: true },
    });

    const statusCounts = {
      DRAFT: 0,
      PENDING: 0,
      CHANGES_REQUESTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };

    for (const r of userRequests) {
      if (r.status in statusCounts) {
        statusCounts[r.status as keyof typeof statusCounts]++;
      }
    }

    // Pending for me count
    const inbox = await requestService.getInboxRequests(user);
    const pendingForMeCount = inbox.length;

    // Average approval time (hours) for all APPROVED requests
    const approvedRequests = await prisma.request.findMany({
      where: {
        status: 'APPROVED',
        submittedAt: { not: null },
        completedAt: { not: null },
      },
      select: {
        submittedAt: true,
        completedAt: true,
      },
    });

    let avgApprovalTimeHours = 0;
    if (approvedRequests.length > 0) {
      const totalTimeMs = approvedRequests.reduce((acc, curr) => {
        const diff = curr.completedAt!.getTime() - curr.submittedAt!.getTime();
        return acc + Math.max(0, diff);
      }, 0);
      avgApprovalTimeHours = Number((totalTimeMs / (approvedRequests.length * 3600 * 1000)).toFixed(2));
    }

    // Recent activity (audit logs related to user or user's requests)
    const recentActivity = await prisma.auditLog.findMany({
      where: user.role === 'ADMIN' || user.role === 'MANAGER'
        ? undefined
        : {
            OR: [
              { actorId: user.id },
              { request: { requesterId: user.id } },
            ],
          },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const formattedActivity = recentActivity.map((a) => {
      let parsed = {};
      try {
        parsed = JSON.parse(a.details);
      } catch {
        // ignore
      }
      return {
        ...a,
        details: parsed,
      };
    });

    res.json({
      statusCounts,
      pendingForMeCount,
      avgApprovalTimeHours,
      recentActivity: formattedActivity,
    });
  })
);

export default router;

