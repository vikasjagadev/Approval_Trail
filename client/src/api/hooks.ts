import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import {
  RequestItem,
  RequestType,
  User,
  AuditLog,
  NotificationItem,
  DashboardStats,
  PaginatedResult,
  VerifyChainResult,
} from './types';

// Dashboard
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardStats>('/dashboard/stats');
      return res.data;
    },
    refetchInterval: 15000,
  });
}

// Notifications
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get<NotificationItem[]>('/notifications');
      return res.data;
    },
    refetchInterval: 10000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/notifications/read-all');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Request Types
export function useRequestTypes(all = false) {
  return useQuery({
    queryKey: ['requestTypes', { all }],
    queryFn: async () => {
      const res = await apiClient.get<RequestType[]>(`/request-types${all ? '?all=1' : ''}`);
      return res.data;
    },
  });
}

export function useRequestType(id: string) {
  return useQuery({
    queryKey: ['requestTypes', id],
    queryFn: async () => {
      const res = await apiClient.get<RequestType>(`/request-types/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateRequestType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<RequestType>) => {
      const res = await apiClient.post<RequestType>('/request-types', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requestTypes'] });
    },
  });
}

export function useUpdateRequestType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RequestType> }) => {
      const res = await apiClient.put<RequestType>(`/request-types/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requestTypes'] });
    },
  });
}

// Users
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get<User[]>('/users');
      return res.data;
    },
  });
}

export function useApprovers() {
  return useQuery({
    queryKey: ['users', 'approvers'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; name: string; role: string; email: string }>>(
        '/users/approvers'
      );
      return res.data;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      password: string;
      role: string;
      managerId?: string | null;
    }) => {
      const res = await apiClient.post<User>('/users', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; role?: string; managerId?: string | null; active?: boolean };
    }) => {
      const res = await apiClient.patch<User>(`/users/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Requests
export function useRequests(params: {
  scope?: 'mine' | 'all';
  status?: string;
  typeId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['requests', params],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResult<RequestItem>>('/requests', { params });
      return res.data;
    },
  });
}

export function useRequestDetail(id: string) {
  return useQuery({
    queryKey: ['requests', id],
    queryFn: async () => {
      const res = await apiClient.get<RequestItem>(`/requests/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { requestTypeId: string; title: string; data: Record<string, unknown> }) => {
      const res = await apiClient.post<RequestItem>('/requests', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { title?: string; data?: Record<string, unknown> };
    }) => {
      const res = await apiClient.put<RequestItem>(`/requests/${id}`, payload);
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['requests', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}

export function useSubmitRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<RequestItem>(`/requests/${id}/submit`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['requests', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useResubmitRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: Record<string, unknown> }) => {
      const res = await apiClient.post<RequestItem>(`/requests/${id}/resubmit`, { data });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['requests', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const res = await apiClient.post<RequestItem>(`/requests/${id}/cancel`, { comment });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['requests', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const res = await apiClient.post(`/requests/${id}/comments`, { body });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['requests', vars.id] });
    },
  });
}

// Inbox & Decisions
export function useInbox() {
  return useQuery({
    queryKey: ['approvals', 'inbox'],
    queryFn: async () => {
      const res = await apiClient.get<RequestItem[]>('/approvals/inbox');
      return res.data;
    },
    refetchInterval: 15000,
  });
}

export function useDecideRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      decision,
      comment,
    }: {
      requestId: string;
      decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
      comment?: string;
    }) => {
      const res = await apiClient.post(`/approvals/${requestId}/decide`, { decision, comment });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['requests', vars.requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['approvals', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Audit
export function useAuditLogs(params: {
  requestId?: string;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResult<AuditLog>>('/audit', { params });
      return res.data;
    },
  });
}

export function useVerifyAudit() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get<VerifyChainResult>('/audit/verify');
      return res.data;
    },
  });
}

