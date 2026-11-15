import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Workflow Engine Tests', () => {
  let aliceToken = '';
  let managerToken = '';
  let approverToken = '';
  let leaveTypeId = '';
  let purchaseTypeId = '';

  beforeAll(async () => {
    const aRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@demo.com', password: 'Passw0rd!' });
    aliceToken = aRes.body.token;

    const mRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'manager@demo.com', password: 'Passw0rd!' });
    managerToken = mRes.body.token;

    const apRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'approver@demo.com', password: 'Passw0rd!' });
    approverToken = apRes.body.token;

    const typesRes = await request(app)
      .get('/api/request-types')
      .set('Authorization', `Bearer ${aliceToken}`);

    leaveTypeId = typesRes.body.find((t: { key: string }) => t.key === 'LEAVE').id;
    purchaseTypeId = typesRes.body.find((t: { key: string }) => t.key === 'PURCHASE').id;
  });

  it('2. Create, submit, and fully approve a LEAVE request through all of its steps (Unpaid triggers HR)', async () => {
    // 1. Create DRAFT
    const createRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestTypeId: leaveTypeId,
        title: 'Unpaid sabbatical leave',
        data: {
          leaveType: 'Unpaid',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
          reason: 'Academic research and study',
        },
      });
    expect(createRes.status).toBe(201);
    const reqId = createRes.body.id;

    // 2. Submit
    const submitRes = await request(app)
      .post(`/api/requests/${reqId}/submit`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe('PENDING');

    // Step 1: Manager approval
    const step1Approve = await request(app)
      .post(`/api/approvals/${reqId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVE', comment: 'Approved by manager' });
    expect(step1Approve.status).toBe(200);
    expect(step1Approve.body.status).toBe('PENDING'); // Moved to HR step

    // Step 2: HR approval (approver)
    const step2Approve = await request(app)
      .post(`/api/approvals/${reqId}/decide`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ decision: 'APPROVE', comment: 'Approved by HR' });
    expect(step2Approve.status).toBe(200);
    expect(step2Approve.body.status).toBe('APPROVED');
    expect(step2Approve.body.completedAt).toBeDefined();
  });

  it('3. Condition skipping: PURCHASE under 1000 skips Finance; at 1000 or more it does not', async () => {
    // Under 1000 ($450)
    const underRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestTypeId: purchaseTypeId,
        title: 'Office monitors',
        data: {
          item: 'External Monitor',
          vendor: 'Dell',
          amount: 450,
          justification: 'Second display for coding',
        },
      });
    const underId = underRes.body.id;

    await request(app)
      .post(`/api/requests/${underId}/submit`)
      .set('Authorization', `Bearer ${aliceToken}`);

    // Manager approves. Since amount < 1000, Finance step was SKIPPED, so it should become APPROVED immediately!
    const managerApproveUnder = await request(app)
      .post(`/api/approvals/${underId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVE' });
    expect(managerApproveUnder.status).toBe(200);
    expect(managerApproveUnder.body.status).toBe('APPROVED');

    // 1000 or more ($2500)
    const overRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestTypeId: purchaseTypeId,
        title: 'New Developer Laptop',
        data: {
          item: 'MacBook Pro 16',
          vendor: 'Apple',
          amount: 2500,
          justification: 'High performance needed for builds',
        },
      });
    const overId = overRes.body.id;

    await request(app)
      .post(`/api/requests/${overId}/submit`)
      .set('Authorization', `Bearer ${aliceToken}`);

    // Manager approves
    const managerApproveOver = await request(app)
      .post(`/api/approvals/${overId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVE' });
    expect(managerApproveOver.status).toBe(200);
    expect(managerApproveOver.body.status).toBe('PENDING'); // Not approved yet, waiting for Finance!

    // Finance approves
    const financeApprove = await request(app)
      .post(`/api/approvals/${overId}/decide`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ decision: 'APPROVE' });
    expect(financeApprove.status).toBe(200);
    expect(financeApprove.body.status).toBe('APPROVED');
  });

  it('6. Reject without a comment returns 400', async () => {
    const createRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestTypeId: leaveTypeId,
        title: 'Casual leave',
        data: {
          leaveType: 'Annual',
          startDate: '2026-10-01',
          endDate: '2026-10-02',
          reason: 'Personal errands',
        },
      });
    const reqId = createRes.body.id;

    await request(app)
      .post(`/api/requests/${reqId}/submit`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const rejectRes = await request(app)
      .post(`/api/approvals/${reqId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: 'REJECT',
        comment: '', // empty comment
      });

    expect(rejectRes.status).toBe(400);
    expect(rejectRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('7. Request changes, then edit, then resubmit gives revision 2 and new steps', async () => {
    const createRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestTypeId: purchaseTypeId,
        title: 'Ergonomic Desk',
        data: {
          item: 'Standing Desk',
          vendor: 'IKEA',
          amount: 500,
          justification: 'Better posture',
        },
      });
    const reqId = createRes.body.id;

    await request(app)
      .post(`/api/requests/${reqId}/submit`)
      .set('Authorization', `Bearer ${aliceToken}`);

    // Manager requests changes
    const reqChangesRes = await request(app)
      .post(`/api/approvals/${reqId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: 'REQUEST_CHANGES',
        comment: 'Please check other vendors or reduce cost',
      });
    expect(reqChangesRes.status).toBe(200);
    expect(reqChangesRes.body.status).toBe('CHANGES_REQUESTED');

    // Alice edits the request
    const editRes = await request(app)
      .put(`/api/requests/${reqId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        data: {
          item: 'Standing Desk (Discounted)',
          vendor: 'Autonomous',
          amount: 400,
          justification: 'Better posture, found lower price vendor',
        },
      });
    expect(editRes.status).toBe(200);

    // Alice resubmits
    const resubmitRes = await request(app)
      .post(`/api/requests/${reqId}/resubmit`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({});
    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.status).toBe('PENDING');
    expect(resubmitRes.body.revision).toBe(2);

    // Verify request details show revision 2 steps
    const detailRes = await request(app)
      .get(`/api/requests/${reqId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(detailRes.body.revision).toBe(2);
    const rev2Steps = detailRes.body.steps.filter((s: { revision: number }) => s.revision === 2);
    expect(rev2Steps.length).toBeGreaterThan(0);
  });

  it('8. Double-decide on the same step returns 409', async () => {
    const createRes = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        requestTypeId: leaveTypeId,
        title: 'Conference leave test',
        data: {
          leaveType: 'Annual',
          startDate: '2026-11-01',
          endDate: '2026-11-03',
          reason: 'Speaking at conference',
        },
      });
    const reqId = createRes.body.id;

    await request(app)
      .post(`/api/requests/${reqId}/submit`)
      .set('Authorization', `Bearer ${aliceToken}`);

    // First decide
    const firstDecide = await request(app)
      .post(`/api/approvals/${reqId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVE' });
    expect(firstDecide.status).toBe(200);

    // Second decide on the same already-decided step
    const secondDecide = await request(app)
      .post(`/api/approvals/${reqId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVE' });
    expect(secondDecide.status).toBe(409);
    expect(secondDecide.body.error.code).toBe('CONFLICT');
  });
});

