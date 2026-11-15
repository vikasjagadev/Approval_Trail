import React from 'react';
import clsx from 'clsx';
import { RequestStatus, StepStatus } from '../api/types';

interface StatusBadgeProps {
  status: RequestStatus | StepStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const getBadgeClass = (s: string) => {
    switch (s) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'CHANGES_REQUESTED':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'CANCELLED':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'WAITING':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'SKIPPED':
        return 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatText = (s: string) => {
    return s.replace(/_/g, ' ');
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide uppercase',
        getBadgeClass(status),
        className
      )}
    >
      {formatText(status)}
    </span>
  );
};

