import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../utils/errors.js';
import { AuthUser } from '../middleware/auth.js';
import { auditService } from './auditService.js';
import { generateRefNo, workflowEngine } from './workflowEngine.js';
import { FormField, validateFormData } from './formValidator.js';

export class RequestService {
  /**
   * Create a new request in DRAFT status
   */
  async createDraft(
    user: AuthUser,
    params: {
      requestTypeId: string;
      title: string;
      data: Record<string, unknown>;
    }
  ) {
    const requestType = await prisma.requestType.findUnique({
      where: { id: params.requestTypeId },
    });

    if (!requestType) {
      throw AppError.notFound('Request type not found');
    }

    if (!requestType.active) {
      throw AppError.conflict('Cannot create request for an inactive request type');
    }

    let formFields: FormField[] = [];
    try {
      formFields = JSON.parse(requestType.formSchema);
    } catch {
      formFields = [];
    }

    // In DRAFT, validate form data
    const validatedData = validateFormData(formFields, params.data, requestType.key);
    const dataString = JSON.stringify(validatedData);

    return prisma.$transaction(async (tx) => {
      const refNo = await generateRefNo(tx);

      const request = await tx.request.create({
        data: {
          refNo,
          requestTypeId: requestType.id,
          requesterId: user.id,
          title: params.title.trim(),
          data: dataString,
          status: 'DRAFT',
          revision: 1,
        },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'REQUEST_CREATED',
        details: { refNo, title: request.title, status: 'DRAFT' },
      });

      return request;
    });
  }

  /**
   * Update request data (DRAFT or CHANGES_REQUESTED only, requester only)
   */
  async updateRequest(
    requestId: string,
    user: AuthUser,
    params: {
      title?: string;
      data?: Record<string, unknown>;
    }
  ) {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { requestType: true },
    });

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    if (request.requesterId !== user.id) {
      throw AppError.forbidden('Only the requester can edit this request');
    }

    if (request.status !== 'DRAFT' && request.status !== 'CHANGES_REQUESTED') {
      throw AppError.conflict(`Cannot edit request in '${request.status}' status`);
    }

    let updatedDataString = request.data;
    if (params.data) {
      let formFields: FormField[] = [];
      try {
        formFields = JSON.parse(request.requestType.formSchema);
      } catch {
        formFields = [];
      }
      const valid = validateFormData(formFields, params.data, request.requestType.key);
      updatedDataString = JSON.stringify(valid);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          title: params.title ? params.title.trim() : request.title,
          data: updatedDataString,
        },
      });

      await auditService.record(tx, {
        requestId: request.id,
        actor: { id: user.id, name: user.name },
        action: 'REQUEST_UPDATED',
        details: { status: request.status, title: updated.title },
      });

      return updated;
    });
  }

  /**
   * Check if user is allowed to access/view a request
   */
  async isUserAuthorizedToView(user: AuthUser, requestId: string): Promise<boolean> {
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      return true;
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        steps: true,
      },
    });

    if (!request) {
      return false;
    }

    if (request.requesterId === user.id) {
      return true;
    }

    // Check if user was or is an assigned approver on any step
    const hasStepMatch = request.steps.some((step) =>
      workflowEngine.canUserDecideStep(user, step, request.requesterId)
    );

    return hasStepMatch;
  }

  /**
   * Get full request details
   */
  async getRequestDetail(requestId: string, user: AuthUser) {
    const isAuth = await this.isUserAuthorizedToView(user, requestId);
    if (!isAuth) {
      throw AppError.forbidden('You do not have permission to view this request');
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        requestType: {
          include: {
            steps: { orderBy: { order: 'asc' } },
          },
        },
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
        steps: {
          orderBy: [{ revision: 'asc' }, { order: 'asc' }],
        },
        comments: {
          orderBy: { createdAt: 'asc' },
        },
        auditLogs: {
          orderBy: { seq: 'asc' },
        },
      },
    });

    if (!request) {
      throw AppError.notFound('Request not found');
    }

    // Parse data safely
    let parsedData: Record<string, unknown> = {};
    try {
      parsedData = JSON.parse(request.data);
    } catch {
      parsedData = {};
    }

    // Parse formSchema safely
    let formSchema: FormField[] = [];
    try {
      formSchema = JSON.parse(request.requestType.formSchema);
    } catch {
      formSchema = [];
    }

    // Resolve author names for comments
    const authorIds = Array.from(new Set(request.comments.map((c) => c.authorId)));
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true, email: true },
    });
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const commentsWithAuthors = request.comments.map((c) => ({
      ...c,
      author: authorMap.get(c.authorId) ?? { id: c.authorId, name: 'Unknown User', email: '' },
    }));

    // Resolve deciders for steps
    const deciderIds = Array.from(
      new Set(request.steps.map((s) => s.decidedById).filter((id): id is string => Boolean(id)))
    );
    const deciders = await prisma.user.findMany({
      where: { id: { in: deciderIds } },
      select: { id: true, name: true, email: true },
    });
    const deciderMap = new Map(deciders.map((d) => [d.id, d]));

    const stepsWithDeciders = request.steps.map((s) => ({
      ...s,
      decider: s.decidedById ? deciderMap.get(s.decidedById) ?? null : null,
    }));

    return {
      ...request,
      parsedData,
      requestType: {
        ...request.requestType,
        formSchema,
      },
      steps: stepsWithDeciders,
      comments: commentsWithAuthors,
    };
  }

  /**
   * List requests with filters and pagination
   */
  async listRequests(
    user: AuthUser,
    params: {
      scope?: 'mine' | 'all';
      status?: string;
      typeId?: string;
      q?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.RequestWhereInput = {};

    if (params.scope === 'all') {
      if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
        throw AppError.forbidden("Only administrators and managers can view all requests with scope='all'");
      }
    } else {
      where.requesterId = user.id;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.typeId) {
      where.requestTypeId = params.typeId;
    }

    if (params.q && params.q.trim()) {
      const q = params.q.trim();
      where.OR = [
        { title: { contains: q } },
        { refNo: { contains: q } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.request.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          requestType: {
            select: { id: true, key: true, name: true },
          },
          requester: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.request.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Add a comment to a request
   */
  async addComment(requestId: string, user: AuthUser, body: string) {
    const isAuth = await this.isUserAuthorizedToView(user, requestId);
    if (!isAuth) {
      throw AppError.forbidden('You do not have permission to comment on this request');
    }

    if (!body || body.trim().length === 0) {
      throw AppError.validationError('Comment body cannot be empty');
    }

    return prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          requestId,
          authorId: user.id,
          body: body.trim(),
        },
      });

      await auditService.record(tx, {
        requestId,
        actor: { id: user.id, name: user.name },
        action: 'COMMENT_ADDED',
        details: { comment: body.trim() },
      });

      return comment;
    });
  }

  /**
   * Inbox: Requests where the current active step is pending for the current user
   */
  async getInboxRequests(user: AuthUser) {
    // Find all PENDING requests
    const pendingRequests = await prisma.request.findMany({
      where: {
        status: 'PENDING',
        currentStepOrder: { not: null },
      },
      include: {
        requestType: {
          select: { id: true, key: true, name: true },
        },
        requester: {
          select: { id: true, name: true, email: true },
        },
        steps: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    // Filter requests where current step matches user and user != requester
    const inbox = pendingRequests.filter((req) => {
      if (req.requesterId === user.id) {
        return false; // self-approval forbidden
      }
      const currentStep = req.steps.find(
        (s) => s.revision === req.revision && s.order === req.currentStepOrder
      );
      if (!currentStep || currentStep.status !== 'PENDING') {
        return false;
      }
      return workflowEngine.canUserDecideStep(user, currentStep, req.requesterId);
    });

    return inbox;
  }
}

export const requestService = new RequestService();

