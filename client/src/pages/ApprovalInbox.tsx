import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInbox } from '../api/hooks';
import { StatusBadge } from '../components/StatusBadge';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { Inbox as InboxIcon, ArrowUpDown, Clock, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export const ApprovalInbox: React.FC = () => {
  const { data: items = [], isLoading } = useInbox();
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');

  const sortedItems = [...items].sort((a, b) => {
    const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Approval Inbox</h1>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {items.length} pending
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Requests currently waiting for your review and sign-off.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === 'oldest' ? 'newest' : 'oldest')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-sm"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>Sort by Age: {sortOrder === 'oldest' ? 'Oldest First' : 'Newest First'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Spinner size="lg" />
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={InboxIcon}
              title="All caught up!"
              description="You have no requests currently awaiting your approval. Nice work!"
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedItems.map((req) => {
              const currentStep = req.steps?.find(
                (s) => s.revision === req.revision && s.order === req.currentStepOrder
              );

              return (
                <div
                  key={req.id}
                  className="p-5 hover:bg-gray-50/75 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {req.refNo}
                      </span>
                      <StatusBadge status={req.status} />
                      <span className="text-xs text-gray-400 font-medium">
                        &bull; {req.requestType.name}
                      </span>
                    </div>

                    <Link
                      to={`/requests/${req.id}`}
                      className="text-base font-bold text-gray-900 hover:text-indigo-600 block transition-colors"
                    >
                      {req.title}
                    </Link>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span>Requester: <strong className="text-gray-700">{req.requester.name}</strong></span>
                      {currentStep && (
                        <span>
                          Current Step: <strong className="text-amber-700 font-semibold">{currentStep.name}</strong>
                        </span>
                      )}
                      {req.submittedAt && (
                        <div className="flex items-center gap-1 text-gray-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Submitted {formatDistanceToNow(new Date(req.submittedAt))} ago ({format(new Date(req.submittedAt), 'MMM d, HH:mm')})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Link
                      to={`/requests/${req.id}`}
                      className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors whitespace-nowrap"
                    >
                      <span>Review &amp; Decide</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

