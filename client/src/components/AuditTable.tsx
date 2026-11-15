import React from 'react';
import { format } from 'date-fns';
import { ShieldCheck } from 'lucide-react';
import { AuditLog } from '../api/types';

interface AuditTableProps {
  logs: AuditLog[];
}

export const AuditTable: React.FC<AuditTableProps> = ({ logs }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">Tamper-Evident Audit Trail</h3>
        </div>
        <span className="text-xs text-gray-500 font-mono">SHA-256 Chained</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
          <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-2.5 px-3"># Seq</th>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Actor</th>
              <th className="py-2.5 px-3">Action</th>
              <th className="py-2.5 px-3">Details</th>
              <th className="py-2.5 px-3 font-mono">Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-400 italic">
                  No audit entries found.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                let parsedDetails = log.details;
                if (typeof log.details === 'string') {
                  try {
                    parsedDetails = JSON.parse(log.details);
                  } catch {
                    // keep string
                  }
                }

                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono font-medium text-gray-900">
                      {log.seq}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                      {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-800">
                      {log.actorName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 max-w-xs truncate">
                      {typeof parsedDetails === 'object' ? (
                        <pre className="text-[11px] font-mono bg-gray-50 p-1 rounded max-w-sm overflow-x-auto">
                          {JSON.stringify(parsedDetails, null, 1)}
                        </pre>
                      ) : (
                        String(parsedDetails)
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-gray-400" title={log.hash}>
                      {log.hash.substring(0, 10)}...{log.hash.substring(log.hash.length - 6)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

