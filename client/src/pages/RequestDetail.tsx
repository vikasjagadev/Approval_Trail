import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useRequestDetail,
  useSubmitRequest,
  useResubmitRequest,
  useCancelRequest,
  useDecideRequest,
  useAddComment,
} from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { ApprovalTimeline } from '../components/ApprovalTimeline';
import { CommentBox } from '../components/CommentBox';
import { AuditTable } from '../components/AuditTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { DynamicForm } from '../components/DynamicForm';
import { format } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Ban,
  Edit,
  History,
  MessageSquare,
  FileText,
  User,
  Calendar,
} from 'lucide-react';

export const RequestDetail: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: request, isLoading, error, refetch } = useRequestDetail(id);

  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'comments' | 'audit'>('details');
  const [isEditing, setIsEditing] = useState(false);

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant: 'primary' | 'warning' | 'danger';
    requireComment: boolean;
    action: (comment?: string) => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    confirmVariant: 'primary',
    requireComment: false,
    action: async () => {},
  });

  const submitMutation = useSubmitRequest();
  const resubmitMutation = useResubmitRequest();
  const cancelMutation = useCancelRequest();
  const decideMutation = useDecideRequest();
  const addCommentMutation = useAddComment();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-2xl mx-auto bg-red-50 text-red-800 p-6 rounded-xl border border-red-200 text-center">
        <h3 className="text-lg font-bold">Request not found or access denied</h3>
        <p className="text-sm mt-2 text-red-600">
          You may not have permission to view this request, or it does not exist.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-semibold hover:bg-gray-50"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isRequester = user?.id === request.requesterId;
  const isAdmin = user?.role === 'ADMIN';

  // Find active step for current revision
  const currentStep = request.steps?.find(
    (s) => s.revision === request.revision && s.order === request.currentStepOrder
  );

  // Check if current user is an authorized approver for the active step
  const canDecide = (() => {
    if (!user || !currentStep || currentStep.status !== 'PENDING' || request.status !== 'PENDING') {
      return false;
    }
    // Self-approval is strictly forbidden
    if (user.id === request.requesterId) {
      return false;
    }
    if (currentStep.approverKind === 'USER') {
      return user.id === currentStep.approverUserId;
    }
    if (currentStep.approverKind === 'ROLE') {
      return user.role === currentStep.approverRole;
    }
    if (currentStep.approverKind === 'REQUESTER_MANAGER') {
      return user.id === currentStep.assignedUserId;
    }
    return false;
  })();

  const canCancel =
    (isRequester || isAdmin) &&
    ['DRAFT', 'PENDING', 'CHANGES_REQUESTED'].includes(request.status);

  // Handlers
  const handleApprove = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Approve Request Step',
      message: `Are you sure you want to approve step "${currentStep?.name}" for request ${request.refNo}?`,
      confirmLabel: 'Approve',
      confirmVariant: 'primary',
      requireComment: false,
      action: async (comment) => {
        await decideMutation.mutateAsync({
          requestId: request.id,
          decision: 'APPROVE',
          comment,
        });
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleReject = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reject Request',
      message: `Please provide a reason for rejecting request ${request.refNo}. This reason will be recorded in the audit trail.`,
      confirmLabel: 'Reject Request',
      confirmVariant: 'danger',
      requireComment: true,
      action: async (comment) => {
        await decideMutation.mutateAsync({
          requestId: request.id,
          decision: 'REJECT',
          comment,
        });
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleRequestChanges = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Request Changes',
      message: `Specify the changes required from ${request.requester.name}. The request will be returned to them for revision.`,
      confirmLabel: 'Send Request for Changes',
      confirmVariant: 'warning',
      requireComment: true,
      action: async (comment) => {
        await decideMutation.mutateAsync({
          requestId: request.id,
          decision: 'REQUEST_CHANGES',
          comment,
        });
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleCancel = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Request',
      message: `Are you sure you want to cancel request ${request.refNo}? This action is terminal and cannot be undone.`,
      confirmLabel: 'Cancel Request',
      confirmVariant: 'danger',
      requireComment: false,
      action: async (comment) => {
        await cancelMutation.mutateAsync({
          id: request.id,
          comment,
        });
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleSubmitDraft = async () => {
    await submitMutation.mutateAsync(request.id);
  };

  const handleResubmit = async (formData: Record<string, unknown>) => {
    await resubmitMutation.mutateAsync({
      id: request.id,
      data: formData,
    });
    setIsEditing(false);
  };

  const handleAddComment = async (body: string) => {
    await addCommentMutation.mutateAsync({ id: request.id, body });
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {request.refNo}
              </span>
              <StatusBadge status={request.status} />
              {request.revision > 1 && (
                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                  Revision {request.revision}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-2 tracking-tight">
              {request.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-2">
              <div className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                <span>Type: <strong className="text-gray-700">{request.requestType.name}</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span>Requester: <strong className="text-gray-700">{request.requester.name}</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <span>Created: {format(new Date(request.createdAt), 'MMM d, yyyy HH:mm')}</span>
              </div>
              {request.completedAt && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span>Finished: {format(new Date(request.completedAt), 'MMM d, yyyy HH:mm')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Panel */}
          <div className="flex flex-wrap items-center gap-2">
            {canDecide && (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  onClick={handleRequestChanges}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Request Changes</span>
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject</span>
                </button>
              </>
            )}

            {isRequester && request.status === 'DRAFT' && (
              <>
                <button
                  type="button"
                  disabled={submitMutation.isPending}
                  onClick={handleSubmitDraft}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  <Send className="h-4 w-4" />
                  <span>{submitMutation.isPending ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </>
            )}

            {isRequester && request.status === 'CHANGES_REQUESTED' && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
              >
                <Edit className="h-4 w-4" />
                <span>Edit &amp; Resubmit</span>
              </button>
            )}

            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Ban className="h-4 w-4 text-gray-500" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-gray-200 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('details')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'details'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Form Data</span>
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'timeline'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Approval Workflow</span>
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'comments'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Comments ({request.comments?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Audit Trail ({request.auditLogs?.length || 0})</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {isEditing ? (
            <div>
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="text-base font-bold text-gray-900">
                  Edit Request Data (Revision {request.revision + 1})
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel Edit
                </button>
              </div>
              <DynamicForm
                fields={request.requestType.formSchema || []}
                initialValues={request.parsedData}
                onSubmit={handleResubmit}
                submitButtonText="Save Changes & Resubmit"
                isSubmitting={resubmitMutation.isPending}
              />
            </div>
          ) : (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-4 border-b pb-2">
                Submitted Form Values
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {request.requestType.formSchema?.map((field) => {
                  const val = request.parsedData?.[field.name];

                  return (
                    <div key={field.name} className="bg-gray-50/75 p-3 rounded-lg border border-gray-100">
                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {field.label}
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-gray-900">
                        {field.type === 'checkbox'
                          ? val
                            ? 'Yes'
                            : 'No'
                          : val !== undefined && val !== null && String(val).trim() !== ''
                          ? String(val)
                          : <span className="text-gray-400 italic">None</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </div>
      )}

      {activeTab === 'timeline' && (
        <ApprovalTimeline
          steps={request.steps || []}
          currentRevision={request.revision}
        />
      )}

      {activeTab === 'comments' && (
        <CommentBox
          comments={request.comments || []}
          onAddComment={handleAddComment}
          isSubmitting={addCommentMutation.isPending}
        />
      )}

      {activeTab === 'audit' && (
        <AuditTable logs={request.auditLogs || []} />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        confirmVariant={confirmDialog.confirmVariant}
        requireComment={confirmDialog.requireComment}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

