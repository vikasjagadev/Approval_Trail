import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequestTypes, useCreateDraft, useSubmitRequest } from '../api/hooks';
import { DynamicForm } from '../components/DynamicForm';
import { Spinner } from '../components/Spinner';
import { AlertCircle, FileText } from 'lucide-react';

export const NewRequest: React.FC = () => {
  const navigate = useNavigate();
  const { data: requestTypes = [], isLoading: isLoadingTypes } = useRequestTypes();
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);

  const createDraftMutation = useCreateDraft();
  const submitRequestMutation = useSubmitRequest();

  const selectedType = requestTypes.find((t) => t.id === selectedTypeId);

  const handleSaveDraft = async (formData: Record<string, unknown>) => {
    if (!title.trim()) {
      setError('Request title is required');
      return;
    }
    setError('');

    try {
      const draft = await createDraftMutation.mutateAsync({
        requestTypeId: selectedTypeId,
        title: title.trim(),
        data: formData,
      });
      navigate(`/requests/${draft.id}`);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as Record<string, unknown>).response === 'object'
      ) {
        const res = (err as { response?: { data?: { error?: { message?: string } } } }).response;
        setError(res?.data?.error?.message || 'Failed to save draft');
      } else {
        setError('Failed to save draft');
      }
    }
  };

  const handleSubmitImmediately = async (formData: Record<string, unknown>) => {
    if (!title.trim()) {
      setError('Request title is required');
      return;
    }
    setError('');
    setIsSubmittingDirect(true);

    try {
      const draft = await createDraftMutation.mutateAsync({
        requestTypeId: selectedTypeId,
        title: title.trim(),
        data: formData,
      });

      await submitRequestMutation.mutateAsync(draft.id);
      navigate(`/requests/${draft.id}`);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as Record<string, unknown>).response === 'object'
      ) {
        const res = (err as { response?: { data?: { error?: { message?: string } } } }).response;
        setError(res?.data?.error?.message || 'Failed to submit request');
      } else {
        setError('Failed to submit request');
      }
    } finally {
      setIsSubmittingDirect(false);
    }
  };

  if (isLoadingTypes) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create Request</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select an approval request type, fill out the form details, and submit for review.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        {/* Step 1: Request Type Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            1. Select Request Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {requestTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setSelectedTypeId(type.id);
                  setError('');
                }}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selectedTypeId === type.id
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className={`h-4 w-4 ${selectedTypeId === type.id ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <span className="font-semibold text-sm text-gray-900">{type.name}</span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        {selectedType && (
          <>
            {/* Step 2: Request Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                2. Request Title / Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Annual Vacation in July, Ergonomic Monitor Setup"
                className="w-full text-sm rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Step 3: Dynamic Form Fields */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                3. {selectedType.name} Details
              </h3>
              <DynamicForm
                fields={selectedType.formSchema}
                onSubmit={handleSubmitImmediately}
                submitButtonText="Submit for Approval"
                isSubmitting={isSubmittingDirect || createDraftMutation.isPending || submitRequestMutation.isPending}
                extraButtons={
                  <button
                    type="button"
                    onClick={(e) => {
                      const form = (e.target as HTMLElement).closest('form');
                      if (form) {
                        const formDataObj = new FormData(form);
                        const data: Record<string, unknown> = {};
                        formDataObj.forEach((val, key) => {
                          data[key] = val;
                        });
                        handleSaveDraft(data);
                      }
                    }}
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Save as Draft
                  </button>
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

