export type Role = 'ADMIN' | 'MANAGER' | 'APPROVER' | 'REQUESTER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId: string | null;
  manager?: { id: string; name: string; email: string } | null;
  active: boolean;
  createdAt: string;
}

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export type ApproverKind = 'ROLE' | 'USER' | 'REQUESTER_MANAGER';

export interface WorkflowCondition {
  field: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
  value: unknown;
}

export interface WorkflowStep {
  id?: string;
  order: number;
  name: string;
  approverKind: ApproverKind;
  approverRole?: string | null;
  approverUserId?: string | null;
  condition?: string | null;
  conditionParsed?: WorkflowCondition | null;
}

export interface RequestType {
  id: string;
  key: string;
  name: string;
  description: string;
  formSchema: FormField[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
}

export type RequestStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type StepStatus =
  | 'WAITING'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SKIPPED'
  | 'CHANGES_REQUESTED';

export interface RequestStep {
  id: string;
  requestId: string;
  revision: number;
  order: number;
  name: string;
  approverKind: ApproverKind;
  approverRole?: string | null;
  approverUserId?: string | null;
  assignedUserId?: string | null;
  status: StepStatus;
  decidedById?: string | null;
  decidedAt?: string | null;
  decider?: { id: string; name: string; email: string } | null;
}

export interface Comment {
  id: string;
  requestId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

export interface AuditLog {
  id: string;
  seq: number;
  requestId?: string | null;
  actorId?: string | null;
  actorName: string;
  action: string;
  details: Record<string, unknown> | string;
  prevHash: string;
  hash: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  message: string;
  requestId?: string | null;
  read: boolean;
  createdAt: string;
}

export interface RequestItem {
  id: string;
  refNo: string;
  requestTypeId: string;
  requestType: { id: string; key: string; name: string; formSchema?: FormField[]; steps?: WorkflowStep[] };
  requesterId: string;
  requester: { id: string; name: string; email: string; role?: string };
  title: string;
  data: string;
  parsedData?: Record<string, unknown>;
  status: RequestStatus;
  revision: number;
  currentStepOrder?: number | null;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  completedAt?: string | null;
  steps?: RequestStep[];
  comments?: Comment[];
  auditLogs?: AuditLog[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardStats {
  statusCounts: Record<RequestStatus, number>;
  pendingForMeCount: number;
  avgApprovalTimeHours: number;
  recentActivity: AuditLog[];
}

export interface VerifyChainResult {
  valid: boolean;
  checked: number;
  firstBrokenSeq: number | null;
}

