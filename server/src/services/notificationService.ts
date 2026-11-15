import { Prisma, PrismaClient } from '@prisma/client';

export class NotificationService {
  async notifyUser(
    tx: Prisma.TransactionClient | PrismaClient,
    params: {
      userId: string;
      message: string;
      requestId?: string | null;
    }
  ) {
    return tx.notification.create({
      data: {
        userId: params.userId,
        message: params.message,
        requestId: params.requestId ?? null,
      },
    });
  }

  async notifyApprovers(
    tx: Prisma.TransactionClient | PrismaClient,
    params: {
      approverKind: string;
      approverRole?: string | null;
      approverUserId?: string | null;
      assignedUserId?: string | null;
      message: string;
      requestId: string;
      excludeUserId?: string;
    }
  ) {
    let targetUserIds: string[] = [];

    if (params.approverKind === 'USER' && params.approverUserId) {
      targetUserIds = [params.approverUserId];
    } else if (params.approverKind === 'REQUESTER_MANAGER' && params.assignedUserId) {
      targetUserIds = [params.assignedUserId];
    } else if (params.approverKind === 'ROLE' && params.approverRole) {
      const users = await tx.user.findMany({
        where: {
          role: params.approverRole,
          active: true,
        },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    }

    if (params.excludeUserId) {
      targetUserIds = targetUserIds.filter((id) => id !== params.excludeUserId);
    }

    const creates = targetUserIds.map((userId) =>
      tx.notification.create({
        data: {
          userId,
          message: params.message,
          requestId: params.requestId,
        },
      })
    );

    return Promise.all(creates);
  }
}

export const notificationService = new NotificationService();

