import React from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle,
  XCircle,
  Inbox,
  FilePlus,
  ArrowRight,
  Timer,
  Activity,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useDashboardStats } from '../api/hooks';
import { Spinner } from '../components/Spinner';
import { format } from 'date-fns';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        Failed to load dashboard metrics.
      </div>
    );
  }

  const myOpenRequests =
    (stats.statusCounts.DRAFT || 0) +
    (stats.statusCounts.PENDING || 0) +
    (stats.statusCounts.CHANGES_REQUESTED || 0);

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Role: <span className="font-semibold text-indigo-600">{user?.role}</span> &bull; Manage your approvals and track request workflows.
          </p>
        </div>
        <Link
          to="/requests/new"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all"
        >
          <FilePlus className="h-4 w-4" />
          <span>Create New Request</span>
        </Link>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Pending for me */}
        <Link
          to="/approvals"
          className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Pending For Me
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Inbox className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">
              {stats.pendingForMeCount}
            </span>
            <span className="text-xs text-gray-500">awaiting decision</span>
          </div>
          <div className="mt-3 flex items-center text-xs font-medium text-amber-600 group-hover:text-amber-700">
            Open inbox <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* My Open Requests */}
        <Link
          to="/my-requests"
          className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              My Open Requests
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">{myOpenRequests}</span>
            <span className="text-xs text-gray-500">drafts / in review</span>
          </div>
          <div className="mt-3 flex items-center text-xs font-medium text-blue-600 group-hover:text-blue-700">
            View submissions <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Approved Requests */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
              Approved
            </span>
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">
              {stats.statusCounts.APPROVED || 0}
            </span>
            <span className="text-xs text-gray-500">fully authorized</span>
          </div>
          <div className="mt-3 flex items-center text-xs text-gray-400">
            Completed approvals
          </div>
        </div>

        {/* Rejected Requests */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">
              Rejected
            </span>
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">
              {stats.statusCounts.REJECTED || 0}
            </span>
            <span className="text-xs text-gray-500">unsuccessful</span>
          </div>
          <div className="mt-3 flex items-center text-xs text-gray-400">
            Includes feedback
          </div>
        </div>
      </div>

      {/* Average turnaround badge */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-lg">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-indigo-950">
              Average Approval Turnaround Time
            </h4>
            <p className="text-xs text-indigo-700">
              Time from initial submission to final sign-off across all active workflows
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-indigo-900">
            {stats.avgApprovalTimeHours}
          </span>
          <span className="text-xs font-semibold text-indigo-700 ml-1">hours</span>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-semibold text-gray-900">Recent Workflow Events</h3>
          </div>
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <Link
              to="/audit"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              View Full Audit Log &rarr;
            </Link>
          )}
        </div>

        <div className="divide-y divide-gray-100">
          {stats.recentActivity.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No recent activity found.</p>
          ) : (
            stats.recentActivity.map((event) => (
              <div key={event.id} className="p-4 hover:bg-gray-50 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-indigo-500" />
                  <div>
                    <span className="font-semibold text-gray-900">{event.actorName}</span>{' '}
                    <span className="font-mono text-xs text-indigo-600 font-medium bg-indigo-50 px-1.5 py-0.5 rounded">
                      {event.action}
                    </span>
                    {event.requestId && (
                      <span className="text-xs text-gray-500 ml-2">
                        Req ID: <code className="font-mono">{event.requestId.substring(0, 8)}...</code>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap">
                  {format(new Date(event.createdAt), 'MMM d, HH:mm')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

