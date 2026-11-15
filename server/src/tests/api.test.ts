import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Auth & API Tests', () => {
  let aliceToken = '';
  let managerToken = '';
  let adminToken = '';
  let leaveTypeId = '';

  beforeAll(async () => {
    // 1. Login success
    const aliceRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@demo.com', password: 'Passw0rd!' });
    expect(aliceRes.status).toBe(200);
    expect(aliceRes.body.token).toBeDefined();
    aliceToken = aliceRes.body.token;

    const managerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@demo.com', password: 'Passw0rd!' });
    managerToken = managerRes.body.token;

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Passw0rd!' });
    adminToken = adminRes.body.token;

    // Get leave type id
    const typesRes = await request(app)
      .get('/api/request-types')
      .set('Authorization', `Bearer ${aliceToken}`);
    const leaveType = typesRes.body.find((t: { key: string }) => t.key === 'LEAVE');
    leaveTypeId = leaveType.id;
  });

  it('1. Login failure with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@demo.com', password: 'WrongPassword' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('9. Invalid form data returns 400 with details', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestTypeId: leaveTypeId,
        title: 'Trip',
        data: {
          leaveType: 'InvalidLeaveType', // not in options
          startDate: 'not-a-date',
          endDate: '2026-05-01',
          reason: 'Resting',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('11. Illegal state transition returns 409', async () => {
    // Create draft
    const draftRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestTypeId: leaveTypeId,
        title: 'Vacation draft',
        data: {
          leaveType: 'Annual',
          startDate: '2026-06-01',
          endDate: '2026-06-05',
          reason: 'Vacation time',
        },
      });
    const reqId = draftRes.body.id;

    // Try to resubmit a draft (resubmit is only valid for CHANGES_REQUESTED)
    const resubmitRes = await request(app)
      .post(`/api/requests/${reqId}/resubmit`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({});
    expect(resubmitRes.status).toBe(409);
    expect(resubmitRes.body.error.code).toBe('CONFLICT');
  });

  it('4. Self-approval is blocked (403)', async () => {
    // Manager creates a request
    const mReqRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        requestTypeId: leaveTypeId,
        title: 'Manager personal leave',
        data: {
          leaveType: 'Annual',
          startDate: '2026-07-01',
          endDate: '2026-07-03',
          reason: 'Need rest',
        },
      });
    const reqId = mReqRes.body.id;

    // Submit request
    await request(app)
      .post(`/api/requests/${reqId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`);

    // Manager attempts to approve their own request
    const decideRes = await request(app)
      .post(`/api/approvals/${reqId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: 'APPROVE',
      });

    expect(decideRes.status).toBe(403);
    expect(decideRes.body.error.code).toBe('FORBIDDEN');
    expect(decideRes.body.error.message).toMatch(/Self-approval is forbidden/);
  });

  it('5. A non-assigned approver is blocked (403)', async () => {
    // Alice creates and submits a request
    const reqRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestTypeId: leaveTypeId,
        title: 'Alice conference leave',
        data: {
          leaveType: 'Annual',
          startDate: '2026-08-01',
          endDate: '2026-08-03',
          reason: 'Attending tech conference',
        },
      });
    const reqId = reqRes.body.id;

    await request(app)
      .post(`/api/requests/${reqId}/submit`)
      .set('Authorization', `Bearer ${aliceToken}`);

    // Bob (another requester, not manager) attempts to decide
    const bobLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@demo.com', password: 'Passw0rd!' });

    const decideRes = await request(app)
      .post(`/api/approvals/${reqId}/decide`)
      .set('Authorization', `Bearer ${bobLogin.body.token}`)
      .send({
        decision: 'APPROVE',
      });

    expect(decideRes.status).toBe(403);
    expect(decideRes.body.error.code).toBe('FORBIDDEN');
  });
});

