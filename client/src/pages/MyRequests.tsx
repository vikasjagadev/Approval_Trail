import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRequests, useRequestTypes } from '../api/hooks';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { Search, Filter, Plus, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { format } from 'date-fns';

export const MyRequests: React.FC = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');
  const [typeId, setTypeId] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const { data: requestTypes = [] } = useRequestTypes();
  const { data, isLoading } = useRequests({
    scope: 'mine',
    status: status || undefined,
    typeId: typeId || undefined,
    q: search || undefined,
    page,
    pageSize: 10,
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and monitor the status of all requests you have submitted or drafted.
          </p>
        </div>
        <Link
          to="/requests/new"
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Request</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title or ref #..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="CHANGES_REQUESTED">Changes Requested</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={typeId}
            onChange={(e) => {
              setTypeId(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Types</option>
            {requestTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Spinner size="lg" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No requests found"
              description="You have not created any requests matching the selected filters."
              action={
                <Link
                  to="/requests/new"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Create your first request &rarr;
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50/75 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Ref No</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {data.items.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-600 whitespace-nowrap">
                        <Link to={`/requests/${req.id}`} className="hover:underline">
                          {req.refNo}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-gray-400" />
                          <span>{req.requestType?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-900 font-medium max-w-xs truncate">
                        <Link to={`/requests/${req.id}`} className="hover:text-indigo-600">
                          {req.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                        {format(new Date(req.createdAt), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/requests/${req.id}`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          View &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-600">
              <div>
                Showing{' '}
                <span className="font-semibold text-gray-900">
                  {Math.min(data.total, (page - 1) * data.pageSize + 1)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-gray-900">
                  {Math.min(data.total, page * data.pageSize)}
                </span>{' '}
                of <span className="font-semibold text-gray-900">{data.total}</span> requests
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
          </>
        )}
      </div>
    </div>
  );
};

