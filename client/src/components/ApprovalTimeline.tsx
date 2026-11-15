import React, { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Clock, XCircle, AlertCircle, MinusCircle, SkipForward } from 'lucide-react';
import { RequestStep } from '../api/types';
import { StatusBadge } from './StatusBadge';

interface ApprovalTimelineProps {
  steps: RequestStep[];
  currentRevision: number;
}

export const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({ steps, currentRevision }) => {
  // Extract unique revisions
  const revisions = Array.from(new Set(steps.map((s) => s.revision))).sort((a, b) => a - b);
  const [selectedRevision, setSelectedRevision] = useState<number>(currentRevision || 1);

  const displayedSteps = steps
    .filter((s) => s.revision === selectedRevision)
    .sort((a, b) => a.order - b.order);

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'CHANGES_REQUESTED':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-amber-600 animate-pulse" />;
      case 'SKIPPED':
        return <SkipForward className="h-5 w-5 text-gray-400" />;
      case 'WAITING':
      default:
        return <MinusCircle className="h-5 w-5 text-gray-300" />;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4 border-b pb-3">
        <h3 className="text-base font-semibold text-gray-900">Approval Workflow</h3>

        {revisions.length > 1 && (
          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-md text-xs">
            {revisions.map((rev) => (
              <button
                key={rev}
                onClick={() => setSelectedRevision(rev)}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  selectedRevision === rev
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Revision {rev} {rev === currentRevision ? '(Current)' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flow-root">
        <ul className="-mb-8">
          {displayedSteps.map((step, stepIdx) => {
            const isLast = stepIdx === displayedSteps.length - 1;

            return (
              <li key={step.id || stepIdx}>
                <div className="relative pb-8">
                  {!isLast && (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                      aria-hidden="true"
                    />
                  )}
                  <div className="relative flex space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-8 ring-white">
                      {getStepIcon(step.status)}
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {step.order}. {step.name}
                          </p>
                          <StatusBadge status={step.status} />
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Approver:{' '}
                          <span className="font-medium text-gray-700">
                            {step.approverKind === 'ROLE' && `Role: ${step.approverRole}`}
                            {step.approverKind === 'USER' && (step.decider ? step.decider.name : 'Assigned User')}
                            {step.approverKind === 'REQUESTER_MANAGER' && 'Requester Direct Manager'}
                          </span>
                        </p>
                        {step.decider && (
                          <p className="text-xs text-indigo-700 mt-0.5">
                            Decided by: {step.decider.name} ({step.decider.email})
                          </p>
                        )}
                      </div>
                      <div className="whitespace-nowrap text-right text-xs text-gray-500">
                        {step.decidedAt ? format(new Date(step.decidedAt), 'MMM d, yyyy HH:mm') : null}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

