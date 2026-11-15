import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db.js';
import { sha256, stableJson } from '../utils/hash.js';

export interface AuditActor {
  id?: string | null;
  name: string;
}

export interface RecordAuditParams {
  requestId?: string | null;
  actor: AuditActor;
  action: string;
  details: Record<string, unknown>;
}

export function computeAuditHash(params: {
  prevHash: string;
  seq: number;
  requestId?: string | null;
  actorId?: string | null;
  action: string;
  details: Record<string, unknown> | string;
  createdAt: Date;
}): string {
  const detailsStr = typeof params.details === 'string' ? params.details : stableJson(params.details);
  const data = `${params.prevHash}|${params.seq}|${params.requestId ?? ''}|${params.actorId ?? ''}|${params.action}|${detailsStr}|${params.createdAt.toISOString()}`;
  return sha256(data);
}

export class AuditService {
  private seqCounter = 0;
  private lastKnownHash: string | null = null;
  private initialized = false;

  private async initialize(tx: Prisma.TransactionClient | PrismaClient) {
    const lastLog = await tx.auditLog.findFirst({
      orderBy: { seq: 'desc' },
    });
    if (lastLog) {
      this.seqCounter = lastLog.seq;
      this.lastKnownHash = lastLog.hash;
    } else {
      this.seqCounter = 0;
      this.lastKnownHash = 'GENESIS';
    }
    this.initialized = true;
  }

  resetMemoryState() {
    this.seqCounter = 0;
    this.lastKnownHash = null;
    this.initialized = false;
  }

  async record(
    tx: Prisma.TransactionClient | PrismaClient,
    params: RecordAuditParams
  ) {
    if (!this.initialized) {
      await this.initialize(tx);
    }

    this.seqCounter += 1;
    const seq = this.seqCounter;
    const prevHash = this.lastKnownHash || 'GENESIS';
    const createdAt = new Date();
    const detailsJson = stableJson(params.details);

    const hash = computeAuditHash({
      prevHash,
      seq,
      requestId: params.requestId,
      actorId: params.actor.id,
      action: params.action,
      details: detailsJson,
      createdAt,
    });

    this.lastKnownHash = hash;

    return tx.auditLog.create({
      data: {
        seq,
        requestId: params.requestId ?? null,
        actorId: params.actor.id ?? null,
        actorName: params.actor.name,
        action: params.action,
        details: detailsJson,
        prevHash,
        hash,
        createdAt,
      },
    });
  }

  async verifyChain(): Promise<{
    valid: boolean;
    checked: number;
    firstBrokenSeq: number | null;
  }> {
    const logs = await prisma.auditLog.findMany({
      orderBy: { seq: 'asc' },
    });

    let prevHash = 'GENESIS';
    let checked = 0;

    for (const log of logs) {
      checked++;

      if (log.prevHash !== prevHash) {
        return {
          valid: false,
          checked,
          firstBrokenSeq: log.seq,
        };
      }

      let parsedDetails: Record<string, unknown> = {};
      try {
        parsedDetails = JSON.parse(log.details);
      } catch {
        // use raw if not json
      }

      const expectedHash = computeAuditHash({
        prevHash: log.prevHash,
        seq: log.seq,
        requestId: log.requestId,
        actorId: log.actorId,
        action: log.action,
        details: stableJson(parsedDetails),
        createdAt: log.createdAt,
      });

      if (log.hash !== expectedHash) {
        return {
          valid: false,
          checked,
          firstBrokenSeq: log.seq,
        };
      }

      prevHash = log.hash;
    }

    return {
      valid: true,
      checked,
      firstBrokenSeq: null,
    };
  }
}

export const auditService = new AuditService();
