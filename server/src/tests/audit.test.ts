import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../db.js';

describe('Audit Hash Chain Tests', () => {
  let adminToken = '';

  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Passw0rd!' });
    adminToken = adminRes.body.token;
  });

  it('10. Audit chain is valid after the flow, and verify reports valid:false after a direct DB tamper of one row', async () => {
    // 1. Verify initially valid
    const verifyRes = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.checked).toBeGreaterThan(0);
    expect(verifyRes.body.firstBrokenSeq).toBeNull();

    // 2. Tamper directly in SQLite
    const targetLog = await prisma.auditLog.findFirst({
      where: { seq: { gt: 1 } },
    });

    if (targetLog) {
      await prisma.auditLog.update({
        where: { id: targetLog.id },
        data: {
          details: JSON.stringify({ tampered: true, evilHacker: 'bypassed audit' }),
        },
      });

      // 3. Verify detects tampering
      const verifyTamperedRes = await request(app)
        .get('/api/audit/verify')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(verifyTamperedRes.status).toBe(200);
      expect(verifyTamperedRes.body.valid).toBe(false);
      expect(verifyTamperedRes.body.firstBrokenSeq).toBe(targetLog.seq);
    }
  });
});

