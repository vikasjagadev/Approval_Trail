import { beforeAll, afterAll } from 'vitest';
import { prisma } from '../db.js';
import { auditService } from '../services/auditService.js';

beforeAll(async () => {
  process.env.DATABASE_URL = 'file:./test.db';
  auditService.resetMemoryState();
});

afterAll(async () => {
  await prisma.$disconnect();
});
