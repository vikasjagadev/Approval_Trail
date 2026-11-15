import React from 'react';
import { Link } from 'react-router-dom';
import { useRequestTypes, useUpdateRequestType } from '../api/hooks';
import { Spinner } from '../components/Spinner';
import { Plus, Edit, Check, X, Layers, GitFork } from 'lucide-react';
import { RequestType } from '../api/types';

export const AdminRequestTypes: React.FC = () => {
  const { data: requestTypes = [], isLoading, refetch } = useRequestTypes(true);
  const updateMutation = useUpdateRequestType();

  const handleToggleActive = async (type: RequestType) => {
    await updateMutation.mutateAsync({
      id: type.id,
      data: {
        name: type.name,
        description: type.description,
        formSchema: type.formSchema,
        steps: type.steps,
        active: !type.active,
      },
    });
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Request Types</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure dynamic approval types, form schemas, and multi-stage workflow rules.
          </p>
        </div>
        <Link
          to="/admin/request-types/new"
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Request Type</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Spinner size="lg" />
          </div>
        ) : requestTypes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No request types found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50/75 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Key</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Form Fields</th>
                  <th className="py-3 px-4">Approval Steps</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {requestTypes.map((type) => (
                  <tr key={type.id} className="hover:bg-gray-50/75">
                    <td className="py-3 px-4 font-mono font-bold text-gray-800 text-xs">
                      {type.key}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      <div>{type.name}</div>
                      <div className="text-xs text-gray-400 font-normal">{type.description}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-gray-400" />
                        <span>{type.formSchema?.length || 0} fields</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <GitFork className="h-3.5 w-3.5 text-gray-400" />
                        <span>{type.steps?.length || 0} steps</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(type)}
                        disabled={updateMutation.isPending}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                          type.active
                            ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {type.active ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            <span>Inactive</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/admin/request-types/${type.id}/edit`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
