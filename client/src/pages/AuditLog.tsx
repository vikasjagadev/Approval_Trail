import React, { useState } from 'react';
import { useAuditLogs, useVerifyAudit } from '../api/hooks';
import { Spinner } from '../components/Spinner';
import { AuditTable } from '../components/AuditTable';
import {
  ShieldCheck,
  Download,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const AuditLog: React.FC = () => {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    checked: number;
    firstBrokenSeq: number | null;
  } | null>(null);

  const { data, isLoading } = useAuditLogs({
    page,
    pageSize: 20,
    action: action || undefined,
    actorId: actorId || undefined,
    requestId: requestId || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  const verifyMutation = useVerifyAudit();

  const handleVerify = async () => {
    const res = await verifyMutation.mutateAsync();
    setVerifyResult(res);
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (action) params.append('action', action);
    if (actorId) params.append('actorId', actorId);
    if (requestId) params.append('requestId', requestId);
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const token = localStorage.getItem('token');
    const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
    fetch(`${apiBase}/audit/export.csv?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_trail_export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Audit Log</h1>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full">
              Tamper-Evident SHA-256
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Immutable, append-only record of every workflow step, decision, comment, and authentication event.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={verifyMutation.isPending}
            onClick={handleVerify}
            className="inline-flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            <span>{verifyMutation.isPending ? 'Verifying...' : 'Verify Integrity'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Verification Banner */}
      {verifyResult && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            verifyResult.valid
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {verifyResult.valid ? (
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="text-sm font-bold">
              {verifyResult.valid
                ? 'Cryptographic Audit Trail Integrity: VALID'
                : 'Cryptographic Audit Trail Integrity: TAMPER DETECTED!'}
            </h3>
            <p className="text-xs mt-1">
              {verifyResult.valid
                ? `Successfully checked ${verifyResult.checked} chained records from GENESIS. Every SHA-256 link in the sequence is intact and uncorrupted.`
                : `Verification failed at sequence #${verifyResult.firstBrokenSeq}! Hash signature does not match database row content. Potential database tampering detected.`}
            </p>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block text-gray-600 font-semibold mb-1">Action Type</label>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Actions</option>
            <option value="USER_LOGIN">USER_LOGIN</option>
            <option value="REQUEST_CREATED">REQUEST_CREATED</option>
            <option value="REQUEST_SUBMITTED">REQUEST_SUBMITTED</option>
            <option value="REQUEST_RESUBMITTED">REQUEST_RESUBMITTED</option>
            <option value="STEP_ACTIVATED">STEP_ACTIVATED</option>
            <option value="STEP_APPROVED">STEP_APPROVED</option>
            <option value="STEP_REJECTED">STEP_REJECTED</option>
            <option value="CHANGES_REQUESTED">CHANGES_REQUESTED</option>
            <option value="REQUEST_APPROVED">REQUEST_APPROVED</option>
            <option value="REQUEST_REJECTED">REQUEST_REJECTED</option>
            <option value="REQUEST_CANCELLED">REQUEST_CANCELLED</option>
            <option value="COMMENT_ADDED">COMMENT_ADDED</option>
            <option value="REQUEST_TYPE_CREATED">REQUEST_TYPE_CREATED</option>
            <option value="REQUEST_TYPE_UPDATED">REQUEST_TYPE_UPDATED</option>
            <option value="USER_CREATED">USER_CREATED</option>
            <option value="USER_UPDATED">USER_UPDATED</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-600 font-semibold mb-1">Request ID</label>
          <input
            type="text"
            placeholder="Filter by Request ID..."
            value={requestId}
            onChange={(e) => {
              setRequestId(e.target.value);
              setPage(1);
            }}
            className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-gray-600 font-semibold mb-1">Date From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-gray-600 font-semibold mb-1">Date To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setAction('');
              setActorId('');
              setRequestId('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
            className="w-full p-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 font-medium"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-gray-200">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-4">
          <AuditTable logs={data?.items || []} />

          {/* Pagination */}
          {data && (
            <div className="p-4 bg-white rounded-xl border border-gray-200 flex items-center justify-between text-xs text-gray-600 shadow-sm">
              <div>
                Showing{' '}
                <span className="font-semibold text-gray-900">
                  {Math.min(data.total, (page - 1) * data.pageSize + 1)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-gray-900">
                  {Math.min(data.total, page * data.pageSize)}
                </span>{' '}
                of <span className="font-semibold text-gray-900">{data.total}</span> audit records
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Previous Page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-medium text-gray-700">
                  Page {page} of {totalPages || 1}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Next Page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

