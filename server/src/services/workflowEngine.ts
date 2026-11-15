import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../utils/errors.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { FormField, validateFormData } from './formValidator.js';
import { AuthUser } from '../middleware/auth.js';

export interface WorkflowCondition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
  value: unknown;
}

export function evaluateCondition(conditionJson: string | null | undefined, data: Record<string, unknown>): boolean {
  if (!conditionJson || conditionJson.trim() === '') {
    return true;
  }

  let cond: WorkflowCondition;
  try {
    cond = JSON.parse(conditionJson);
  } catch {
    return true;
  }

  const dataVal = data[cond.field];
  const targetVal = cond.value;

  switch (cond.op) {
    case 'eq':
      return String(dataVal).toLowerCase() === String(targetVal).toLowerCase();
    case 'neq':
      return String(dataVal).toLowerCase() !== String(targetVal).toLowerCase();
    case 'gt':
      return Number(dataVal) > Number(targetVal);
    case 'gte':
      return Number(dataVal) >= Number(targetVal);
    case 'lt':
      return Number(dataVal) < Number(targetVal);
    case 'lte':
      return Number(dataVal) <= Number(targetVal);
    default:
      return true;
  }
}

export async function generateRefNo(tx: Prisma.TransactionClient | PrismaClient): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `REQ-${currentYear}-`;
  const count = await tx.request.count({
    where: {
      refNo: {
        startsWith: prefix,
      },
    },
  });
  const seqNum = String(count + 1).padStart(4, '0');
  return `${prefix}${seqNum}`;
}

export class WorkflowEngine {
  /**
   * Helper to check if a user is authorized to decide a specific step.
   */
  canUserDecideStep(user: AuthUser, step: {
    approverKind: string;
    approverRole?: string | null;
    approverUserId?: string | null;
    assignedUserId?: string | null;
  }, requesterId: string): boolean {
    // Rule: Self-approval is forbidden.
    if (user.id === requesterId) {
      return false;
    }

    if (step.approverKind === 'USER') {
      return user.id === step.approverUserId;
    }

    if (step.approverKind === 'ROLE') {
      return user.role === step.approverRole;
    }

    if (step.approverKind === 'REQUESTER_MANAGER') {
      return user.id === step.assignedUserId;
    }

    return false;
  }

  /**
   * Resolves manager or fallback admin for REQUESTER_MANAGER step
   */
  private async resolveManagerUserId(
    tx: Prisma.TransactionClient,
    requesterId: string
  ): Promise<string | null> {
    const requester = await tx.user.findUnique({
      where: { id: requesterId },
      include: { manager: true },
    });

    if (requester?.managerId && requester.manager?.active) {
      return requester.managerId;
    }

    // Fall back to any active ADMIN
    const fallbackAdmin = await tx.user.findFirst({
      where: { role: 'ADMIN', active: true },
    });

    return fallbackAdmin ? fallbackAdmin.id : null;
  }

  /**
   * Submit a DRAFT request
   */
  async submitRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    user: AuthUser
  ) {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: { requestType: { include: { steps: { orderBy: { order: 'asc' } } } }, requester: true },
    });

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    if (request.requesterId !== user.id) {
      throw AppError.forbidden('Only the requester can submit this request');
    }

    if (request.status !== 'DRAFT') {
      throw AppError.conflict(`Cannot submit a request in '${request.status}' status`);
    }

    if (!request.requestType.active) {
      throw AppError.conflict('Cannot submit a request for an inactive request type');
    }

    // Parse and validate form data against schema
    let formFields: FormField[] = [];
    try {
      formFields = JSON.parse(request.requestType.formSchema);
    } catch {
      formFields = [];
    }

    let parsedData: Record<string, unknown> = {};
    try {
      parsedData = JSON.parse(request.data);
    } catch {
      parsedData = {};
    }

    validateFormData(formFields, parsedData, request.requestType.key);

    // Snapshot workflow steps into RequestStep for revision 1
    const workflowSteps = request.requestType.steps;
    const resolvedManagerId = await this.resolveManagerUserId(tx, request.requesterId);

    const stepSnapshots: {
      requestId: string;
      revision: number;
      order: number;
      name: string;
      approverKind: string;
      approverRole: string | null;
      approverUserId: string | null;
      assignedUserId: string | null;
      status: string;
    }[] = [];

    for (const step of workflowSteps) {
      const conditionMatches = evaluateCondition(step.condition, parsedData);
      const isSkipped = !conditionMatches;
      const assignedUserId = step.approverKind === 'REQUESTER_MANAGER' ? resolvedManagerId : null;

      stepSnapshots.push({
        requestId: request.id,
        revision: request.revision,
        order: step.order,
        name: step.name,
        approverKind: step.approverKind,
        approverRole: step.approverRole,
        approverUserId: step.approverUserId,
        assignedUserId,
        status: isSkipped ? 'SKIPPED' : 'WAITING',
      });
    }

    // Find first non-skipped step
    const firstActiveIndex = stepSnapshots.findIndex((s) => s.status !== 'SKIPPED');

    if (firstActiveIndex === -1) {
      // All steps skipped: Auto-approve
      for (const s of stepSnapshots) {
        await tx.requestStep.create({ data: s });
      }

      const now = new Date();
      const updated = await tx.request.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          submittedAt: now,
          completedAt: now,
          currentStepOrder: null,
        },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'REQUEST_SUBMITTED',
        details: { before: 'DRAFT', after: 'APPROVED', autoApproved: true },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: 'SYSTEM', name: 'System' },
        action: 'REQUEST_APPROVED',
        details: { before: 'PENDING', after: 'APPROVED', note: 'All steps skipped' },
      });

      await notificationService.notifyUser(tx, {
        userId: request.requesterId,
        message: `Your request ${request.refNo} was automatically approved.`,
        requestId: request.id,
      });

      return updated;
    }

    // Set first active step to PENDING
    stepSnapshots[firstActiveIndex].status = 'PENDING';

    const createdSteps: Array<Prisma.RequestStepGetPayload<Record<string, never>>> = [];
    for (const s of stepSnapshots) {
      const stepRow = await tx.requestStep.create({ data: s });
      createdSteps.push(stepRow);
    }

    const firstStep = stepSnapshots[firstActiveIndex];
    const now = new Date();
    const updated = await tx.request.update({
      where: { id: request.id },
      data: {
        status: 'PENDING',
        submittedAt: now,
        currentStepOrder: firstStep.order,
      },
    });

    await auditService.record(tx, {
      requestId: request.id,
      actor: { id: user.id, name: user.name },
      action: 'REQUEST_SUBMITTED',
      details: { before: 'DRAFT', after: 'PENDING' },
    });

    await auditService.record(tx, {
      requestId: request.id,
      actor: { id: 'SYSTEM', name: 'System' },
      action: 'STEP_ACTIVATED',
      details: { stepName: firstStep.name, order: firstStep.order },
    });

    // Notify approver(s)
    await notificationService.notifyApprovers(tx, {
      approverKind: firstStep.approverKind,
      approverRole: firstStep.approverRole,
      approverUserId: firstStep.approverUserId,
      assignedUserId: firstStep.assignedUserId,
      message: `A new request ${request.refNo} requires your approval: ${request.title}`,
      requestId: request.id,
      excludeUserId: user.id,
    });

    return updated;
  }

  /**
   * Resubmit after changes were requested
   */
  async resubmitRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    user: AuthUser,
    updatedData?: Record<string, unknown>
  ) {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: { requestType: { include: { steps: { orderBy: { order: 'asc' } } } } },
    });

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    if (request.requesterId !== user.id) {
      throw AppError.forbidden('Only the requester can resubmit this request');
    }

    if (request.status !== 'CHANGES_REQUESTED') {
      throw AppError.conflict(`Cannot resubmit a request in '${request.status}' status`);
    }

    let formFields: FormField[] = [];
    try {
      formFields = JSON.parse(request.requestType.formSchema);
    } catch {
      formFields = [];
    }

    const dataToValidate = updatedData ?? JSON.parse(request.data);
    const validData = validateFormData(formFields, dataToValidate, request.requestType.key);
    const validDataString = JSON.stringify(validData);

    const nextRevision = request.revision + 1;
    const resolvedManagerId = await this.resolveManagerUserId(tx, request.requesterId);

    const stepSnapshots: {
      requestId: string;
      revision: number;
      order: number;
      name: string;
      approverKind: string;
      approverRole: string | null;
      approverUserId: string | null;
      assignedUserId: string | null;
      status: string;
    }[] = [];

    for (const step of request.requestType.steps) {
      const conditionMatches = evaluateCondition(step.condition, validData);
      const isSkipped = !conditionMatches;
      const assignedUserId = step.approverKind === 'REQUESTER_MANAGER' ? resolvedManagerId : null;

      stepSnapshots.push({
        requestId: request.id,
        revision: nextRevision,
        order: step.order,
        name: step.name,
        approverKind: step.approverKind,
        approverRole: step.approverRole,
        approverUserId: step.approverUserId,
        assignedUserId,
        status: isSkipped ? 'SKIPPED' : 'WAITING',
      });
    }

    const firstActiveIndex = stepSnapshots.findIndex((s) => s.status !== 'SKIPPED');

    if (firstActiveIndex === -1) {
      for (const s of stepSnapshots) {
        await tx.requestStep.create({ data: s });
      }

      const now = new Date();
      const updated = await tx.request.update({
        where: { id: request.id },
        data: {
          data: validDataString,
          status: 'APPROVED',
          revision: nextRevision,
          completedAt: now,
          currentStepOrder: null,
        },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'REQUEST_RESUBMITTED',
        details: { before: 'CHANGES_REQUESTED', after: 'APPROVED', revision: nextRevision },
      });

      return updated;
    }

    stepSnapshots[firstActiveIndex].status = 'PENDING';

    for (const s of stepSnapshots) {
      await tx.requestStep.create({ data: s });
    }

    const firstStep = stepSnapshots[firstActiveIndex];
    const updated = await tx.request.update({
      where: { id: request.id },
      data: {
        data: validDataString,
        status: 'PENDING',
        revision: nextRevision,
        currentStepOrder: firstStep.order,
      },
    });

    await auditService.record(tx, {
      requestId: request.id,
      actor: { id: user.id, name: user.name },
      action: 'REQUEST_RESUBMITTED',
      details: { before: 'CHANGES_REQUESTED', after: 'PENDING', revision: nextRevision },
    });

    await auditService.record(tx, {
      requestId: request.id,
      actor: { id: 'SYSTEM', name: 'System' },
      action: 'STEP_ACTIVATED',
      details: { stepName: firstStep.name, order: firstStep.order, revision: nextRevision },
    });

    await notificationService.notifyApprovers(tx, {
      approverKind: firstStep.approverKind,
      approverRole: firstStep.approverRole,
      approverUserId: firstStep.approverUserId,
      assignedUserId: firstStep.assignedUserId,
      message: `Request ${request.refNo} was resubmitted and requires your approval`,
      requestId: request.id,
      excludeUserId: user.id,
    });

    return updated;
  }

  /**
   * Decide on a step (APPROVE, REJECT, REQUEST_CHANGES)
   */
  async decideStep(
    tx: Prisma.TransactionClient,
    requestId: string,
    user: AuthUser,
    params: {
      decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
      comment?: string;
    }
  ) {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    if (request.status !== 'PENDING') {
      throw AppError.conflict(`Cannot make a decision on a request in '${request.status}' status`);
    }

    // Find current active step
    const currentStep = request.steps.find(
      (s) => s.revision === request.revision && s.order === request.currentStepOrder
    );

    if (!currentStep) {
      throw AppError.conflict('No pending step found for this request');
    }

    // Concurrency check: must be PENDING
    if (currentStep.status !== 'PENDING') {
      throw AppError.conflict('Step already decided');
    }

    // Self-approval is strictly forbidden
    if (user.id === request.requesterId) {
      throw AppError.forbidden('Self-approval is forbidden. Requesters cannot decide their own requests.');
    }

    // Approver authorization
    const isAuthorized = this.canUserDecideStep(user, currentStep, request.requesterId);
    if (!isAuthorized) {
      throw AppError.forbidden('You are not authorized to decide this approval step');
    }

    const now = new Date();

    if (params.decision === 'APPROVE') {
      // Mark step APPROVED
      await tx.requestStep.update({
        where: { id: currentStep.id },
        data: {
          status: 'APPROVED',
          decidedById: user.id,
          decidedAt: now,
        },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'STEP_APPROVED',
        details: { stepName: currentStep.name, order: currentStep.order, revision: currentStep.revision },
      });

      if (params.comment && params.comment.trim().length > 0) {
        await tx.comment.create({
          data: {
            requestId: request.id,
            authorId: user.id,
            body: params.comment.trim(),
          },
        });
        await auditService.record(tx, {
          requestId: request.id,
          actor: { id: user.id, name: user.name },
          action: 'COMMENT_ADDED',
          details: { comment: params.comment.trim(), stepName: currentStep.name },
        });
      }

      // Find next non-skipped step in current revision
      const remainingSteps = request.steps.filter(
        (s) => s.revision === request.revision && s.order > currentStep.order
      );

      const nextActiveStep = remainingSteps.find((s) => s.status !== 'SKIPPED');

      if (nextActiveStep) {
        // Move to next step
        await tx.requestStep.update({
          where: { id: nextActiveStep.id },
          data: { status: 'PENDING' },
        });

        const updated = await tx.request.update({
          where: { id: request.id },
          data: {
            currentStepOrder: nextActiveStep.order,
          },
        });

        await auditService.record(tx, {
          requestId: request.id,
          actor: { id: 'SYSTEM', name: 'System' },
          action: 'STEP_ACTIVATED',
          details: { stepName: nextActiveStep.name, order: nextActiveStep.order },
        });

        await notificationService.notifyApprovers(tx, {
          approverKind: nextActiveStep.approverKind,
          approverRole: nextActiveStep.approverRole,
          approverUserId: nextActiveStep.approverUserId,
          assignedUserId: nextActiveStep.assignedUserId,
          message: `Request ${request.refNo} requires your approval: ${nextActiveStep.name}`,
          requestId: request.id,
          excludeUserId: user.id,
        });

        return updated;
      } else {
        // All steps approved!
        const updated = await tx.request.update({
          where: { id: request.id },
          data: {
            status: 'APPROVED',
            completedAt: now,
            currentStepOrder: null,
          },
        });

        await auditService.record(tx, {
          requestId: request.id,
          actor: { id: user.id, name: user.name },
          action: 'REQUEST_APPROVED',
          details: { before: 'PENDING', after: 'APPROVED', lastStep: currentStep.name },
        });

        await notificationService.notifyUser(tx, {
          userId: request.requesterId,
          message: `Your request ${request.refNo} (${request.title}) has been approved!`,
          requestId: request.id,
        });

        return updated;
      }
    } else if (params.decision === 'REJECT') {
      if (!params.comment || params.comment.trim().length < 3) {
        throw AppError.validationError('A reason comment of at least 3 characters is required to reject a request', [
          { field: 'comment', message: 'Comment must be at least 3 characters' },
        ]);
      }

      await tx.requestStep.update({
        where: { id: currentStep.id },
        data: {
          status: 'REJECTED',
          decidedById: user.id,
          decidedAt: now,
        },
      });

      // Mark remaining steps in this revision as SKIPPED
      const remainingSteps = request.steps.filter(
        (s) => s.revision === request.revision && s.order > currentStep.order && s.status !== 'SKIPPED'
      );

      for (const s of remainingSteps) {
        await tx.requestStep.update({
          where: { id: s.id },
          data: { status: 'SKIPPED' },
        });
      }

      const updated = await tx.request.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          completedAt: now,
          currentStepOrder: null,
        },
      });

      await tx.comment.create({
        data: {
          requestId: request.id,
          authorId: user.id,
          body: params.comment.trim(),
        },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'STEP_REJECTED',
        details: { stepName: currentStep.name, order: currentStep.order, comment: params.comment.trim() },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'COMMENT_ADDED',
        details: { comment: params.comment.trim(), stepName: currentStep.name },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'REQUEST_REJECTED',
        details: { before: 'PENDING', after: 'REJECTED', step: currentStep.name, reason: params.comment.trim() },
      });

      await notificationService.notifyUser(tx, {
        userId: request.requesterId,
        message: `Your request ${request.refNo} was rejected by ${user.name}: "${params.comment.trim()}"`,
        requestId: request.id,
      });

      return updated;
    } else if (params.decision === 'REQUEST_CHANGES') {
      if (!params.comment || params.comment.trim().length < 3) {
        throw AppError.validationError('A comment of at least 3 characters explaining requested changes is required', [
          { field: 'comment', message: 'Comment must be at least 3 characters' },
        ]);
      }

      await tx.requestStep.update({
        where: { id: currentStep.id },
        data: {
          status: 'CHANGES_REQUESTED',
          decidedById: user.id,
          decidedAt: now,
        },
      });

      const updated = await tx.request.update({
        where: { id: request.id },
        data: {
          status: 'CHANGES_REQUESTED',
        },
      });

      await tx.comment.create({
        data: {
          requestId: request.id,
          authorId: user.id,
          body: params.comment.trim(),
        },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'CHANGES_REQUESTED',
        details: { stepName: currentStep.name, order: currentStep.order, comment: params.comment.trim() },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'COMMENT_ADDED',
        details: { comment: params.comment.trim(), stepName: currentStep.name },
      });

      await notificationService.notifyUser(tx, {
        userId: request.requesterId,
        message: `Changes requested on your request ${request.refNo} by ${user.name}: "${params.comment.trim()}"`,
        requestId: request.id,
      });

      return updated;
    }

    throw AppError.validationError('Invalid decision value');
  }

  /**
   * Cancel request (DRAFT, PENDING, CHANGES_REQUESTED)
   */
  async cancelRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    user: AuthUser,
    comment?: string
  ) {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: { steps: true },
    });

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    // Only requester or ADMIN can cancel
    if (request.requesterId !== user.id && user.role !== 'ADMIN') {
      throw AppError.forbidden('Only the requester or an administrator can cancel this request');
    }

    // Allowed from DRAFT, PENDING, CHANGES_REQUESTED
    const cancellableStatuses = ['DRAFT', 'PENDING', 'CHANGES_REQUESTED'];
    if (!cancellableStatuses.includes(request.status)) {
      throw AppError.conflict(`Cannot cancel a request in '${request.status}' status`);
    }

    const now = new Date();

    // Mark remaining active/waiting steps as SKIPPED
    for (const step of request.steps) {
      if (step.revision === request.revision && (step.status === 'PENDING' || step.status === 'WAITING')) {
        await tx.requestStep.update({
          where: { id: step.id },
          data: { status: 'SKIPPED' },
        });
      }
    }

    const updated = await tx.request.update({
      where: { id: request.id },
      data: {
        status: 'CANCELLED',
        completedAt: now,
        currentStepOrder: null,
      },
    });

    if (comment && comment.trim().length > 0) {
      await tx.comment.create({
        data: {
          requestId: request.id,
          authorId: user.id,
          body: comment.trim(),
        },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'COMMENT_ADDED',
        details: { comment: comment.trim(), reason: 'Cancellation note' },
      });
    }

    await auditService.record(tx, {
      requestId: request.id,
      actor: { id: user.id, name: user.name },
      action: 'REQUEST_CANCELLED',
      details: {
        before: request.status,
        after: 'CANCELLED',
        cancelledBy: user.name,
        comment: comment ? comment.trim() : null,
      },
    });

    if (user.id !== request.requesterId) {
      await notificationService.notifyUser(tx, {
        userId: request.requesterId,
        message: `Your request ${request.refNo} was cancelled by administrator ${user.name}`,
        requestId: request.id,
      });
    }

    return updated;
  }
}

export const workflowEngine = new WorkflowEngine();

