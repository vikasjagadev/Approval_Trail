import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useRequestType,
  useCreateRequestType,
  useUpdateRequestType,
  useApprovers,
} from '../api/hooks';
import { FormField, WorkflowStep, FieldType, ApproverKind, WorkflowCondition } from '../api/types';
import { DynamicForm } from '../components/DynamicForm';
import { Spinner } from '../components/Spinner';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  GitFork,
  Eye,
  Save,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

export const AdminRequestTypeEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id && id !== 'new');
  const navigate = useNavigate();

  const { data: existingType, isLoading: isLoadingType } = useRequestType(id || '');
  const { data: approverUsers = [] } = useApprovers();

  const createMutation = useCreateRequestType();
  const updateMutation = useUpdateRequestType();

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingType && isEditing) {
      setKey(existingType.key);
      setName(existingType.name);
      setDescription(existingType.description || '');
      setActive(existingType.active);
      setFields(existingType.formSchema || []);
      setSteps(existingType.steps || []);
    }
  }, [existingType, isEditing]);

  // Field handlers
  const handleAddField = () => {
    const newField: FormField = {
      name: `field_${fields.length + 1}`,
      label: `New Field ${fields.length + 1}`,
      type: 'text',
      required: true,
    };
    setFields([...fields, newField]);
  };

  const handleUpdateField = (index: number, updated: Partial<FormField>) => {
    const copy = [...fields];
    copy[index] = { ...copy[index], ...updated };
    setFields(copy);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === fields.length - 1)
    ) {
      return;
    }
    const target = direction === 'up' ? index - 1 : index + 1;
    const copy = [...fields];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setFields(copy);
  };

  // Step handlers
  const handleAddStep = () => {
    const newOrder = steps.length + 1;
    const newStep: WorkflowStep = {
      order: newOrder,
      name: `Approval Step ${newOrder}`,
      approverKind: 'ROLE',
      approverRole: 'APPROVER',
      condition: null,
      conditionParsed: null,
    };
    setSteps([...steps, newStep]);
  };

  const handleUpdateStep = (index: number, updated: Partial<WorkflowStep>) => {
    const copy = [...steps];
    copy[index] = { ...copy[index], ...updated };
    setSteps(copy);
  };

  const handleRemoveStep = (index: number) => {
    const copy = steps.filter((_, i) => i !== index);
    // Re-index orders
    const reindexed = copy.map((s, idx) => ({ ...s, order: idx + 1 }));
    setSteps(reindexed);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) {
      return;
    }
    const target = direction === 'up' ? index - 1 : index + 1;
    const copy = [...steps];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    // Re-index orders
    const reindexed = copy.map((s, idx) => ({ ...s, order: idx + 1 }));
    setSteps(reindexed);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!key.trim()) {
      setError('Key is required (e.g. TRAVEL)');
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (fields.length === 0) {
      setError('At least one form field is required');
      return;
    }

    if (active && steps.length === 0) {
      setError('At least one workflow step is required before the request type can be active');
      return;
    }

    const cleanedSteps = steps.map((s, idx) => ({
      order: idx + 1,
      name: s.name,
      approverKind: s.approverKind,
      approverRole: s.approverKind === 'ROLE' ? s.approverRole || 'APPROVER' : null,
      approverUserId: s.approverKind === 'USER' ? s.approverUserId || null : null,
      condition: s.conditionParsed && s.conditionParsed.field
        ? JSON.stringify(s.conditionParsed)
        : null,
    }));

    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({
          id,
          data: {
            name: name.trim(),
            description: description.trim(),
            formSchema: fields,
            steps: cleanedSteps,
            active,
          },
        });
      } else {
        await createMutation.mutateAsync({
          key: key.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim(),
          formSchema: fields,
          steps: cleanedSteps,
          active,
        });
      }
      navigate('/admin/request-types');
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as Record<string, unknown>).response === 'object'
      ) {
        const res = (err as { response?: { data?: { error?: { message?: string } } } }).response;
        setError(res?.data?.error?.message || 'Failed to save request type');
      } else {
        setError('Failed to save request type');
      }
    }
  };

  if (isEditing && isLoadingType) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/request-types')}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {isEditing ? `Edit Request Type: ${name}` : 'Create New Request Type'}
            </h1>
            <p className="text-sm text-gray-500">
              Define the form inputs and conditional approval routing stages.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>Save Request Type</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* General Information */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900">General Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Unique Key <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isEditing}
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="e.g. TRAVEL, EXPENSE, HARDWARE"
              className="w-full text-sm font-mono uppercase rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Short code identifier (cannot be changed once created).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Travel & Flight Approval"
              className="w-full text-sm rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief explanation of what this request type is used for..."
            className="w-full text-sm rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="active-toggle"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="active-toggle" className="text-sm font-medium text-gray-700">
            Active and available for users to submit
          </label>
        </div>
      </div>

      {/* Form Fields Builder */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-gray-900">Form Schema Fields ({fields.length})</h2>
          </div>
          <button
            type="button"
            onClick={handleAddField}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-md"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Field</span>
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">
            No fields defined yet. Click "Add Field" to define form fields.
          </p>
        ) : (
          <div className="space-y-4">
            {fields.map((field, idx) => (
              <div
                key={idx}
                className="p-4 bg-gray-50/75 rounded-lg border border-gray-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-white text-gray-600 border px-2 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {field.label || 'Unnamed Field'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveField(idx, 'up')}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === fields.length - 1}
                      onClick={() => handleMoveField(idx, 'down')}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(idx)}
                      className="p-1 text-red-500 hover:text-red-700 ml-2"
                      title="Remove Field"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-gray-600 font-medium mb-1">Field Name (camelCase)</label>
                    <input
                      type="text"
                      required
                      value={field.name}
                      onChange={(e) => handleUpdateField(idx, { name: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 font-medium mb-1">Field Label</label>
                    <input
                      type="text"
                      required
                      value={field.label}
                      onChange={(e) => handleUpdateField(idx, { label: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 font-medium mb-1">Type</label>
                    <select
                      value={field.type}
                      onChange={(e) =>
                        handleUpdateField(idx, {
                          type: e.target.value as FieldType,
                          options: e.target.value === 'select' ? ['Option 1', 'Option 2'] : undefined,
                        })
                      }
                      className="w-full p-2 border border-gray-300 rounded bg-white text-xs"
                    >
                      <option value="text">Text</option>
                      <option value="textarea">Textarea</option>
                      <option value="number">Number</option>
                      <option value="date">Date (YYYY-MM-DD)</option>
                      <option value="select">Select Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id={`req_${idx}`}
                      checked={field.required}
                      onChange={(e) => handleUpdateField(idx, { required: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                    <label htmlFor={`req_${idx}`} className="text-xs text-gray-700 font-medium">
                      Required Field
                    </label>
                  </div>
                </div>

                {field.type === 'select' && (
                  <div className="text-xs">
                    <label className="block text-gray-600 font-medium mb-1">
                      Options (comma-separated list)
                    </label>
                    <input
                      type="text"
                      value={field.options?.join(', ') || ''}
                      onChange={(e) =>
                        handleUpdateField(idx, {
                          options: e.target.value
                            .split(',')
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="e.g. Low, Medium, High"
                      className="w-full p-2 border border-gray-300 rounded bg-white text-xs"
                    />
                  </div>
                )}

                {field.type === 'number' && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Minimum Value</label>
                      <input
                        type="number"
                        value={field.min ?? ''}
                        onChange={(e) =>
                          handleUpdateField(idx, {
                            min: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Maximum Value</label>
                      <input
                        type="number"
                        value={field.max ?? ''}
                        onChange={(e) =>
                          handleUpdateField(idx, {
                            max: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded bg-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workflow Steps Builder */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <GitFork className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-gray-900">
              Approval Workflow Routing ({steps.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={handleAddStep}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-md"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Step</span>
          </button>
        </div>

        {steps.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">
            No approval steps defined. Click "Add Step" to configure who reviews this request.
          </p>
        ) : (
          <div className="space-y-4">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="p-4 bg-gray-50/75 rounded-lg border border-gray-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-white text-gray-600 border px-2 py-0.5 rounded">
                      Step {step.order}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{step.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStep(idx, 'up')}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === steps.length - 1}
                      onClick={() => handleMoveStep(idx, 'down')}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="p-1 text-red-500 hover:text-red-700 ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-gray-600 font-medium mb-1">Step Name</label>
                    <input
                      type="text"
                      required
                      value={step.name}
                      onChange={(e) => handleUpdateStep(idx, { name: e.target.value })}
                      placeholder="e.g. Manager Approval, Finance Sign-off"
                      className="w-full p-2 border border-gray-300 rounded bg-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 font-medium mb-1">Approver Type</label>
                    <select
                      value={step.approverKind}
                      onChange={(e) =>
                        handleUpdateStep(idx, {
                          approverKind: e.target.value as ApproverKind,
                          approverRole: e.target.value === 'ROLE' ? 'APPROVER' : null,
                          approverUserId: null,
                        })
                      }
                      className="w-full p-2 border border-gray-300 rounded bg-white text-xs"
                    >
                      <option value="ROLE">Role (Any user with role)</option>
                      <option value="REQUESTER_MANAGER">Requester Manager (Direct report)</option>
                      <option value="USER">Specific User</option>
                    </select>
                  </div>

                  <div>
                    {step.approverKind === 'ROLE' && (
                      <div>
                        <label className="block text-gray-600 font-medium mb-1">Target Role</label>
                        <select
                          value={step.approverRole || 'APPROVER'}
                          onChange={(e) => handleUpdateStep(idx, { approverRole: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded bg-white text-xs"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="APPROVER">APPROVER</option>
                        </select>
                      </div>
                    )}

                    {step.approverKind === 'USER' && (
                      <div>
                        <label className="block text-gray-600 font-medium mb-1">Target User</label>
                        <select
                          value={step.approverUserId || ''}
                          onChange={(e) =>
                            handleUpdateStep(idx, { approverUserId: e.target.value || null })
                          }
                          className="w-full p-2 border border-gray-300 rounded bg-white text-xs"
                        >
                          <option value="">-- Select Specific Approver --</option>
                          {approverUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {step.approverKind === 'REQUESTER_MANAGER' && (
                      <div className="pt-2 text-gray-500 italic text-[11px]">
                        Resolved dynamically from the requester's direct manager.
                      </div>
                    )}
                  </div>
                </div>

                {/* Condition Builder */}
                <div className="bg-white p-3 rounded border border-gray-200 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">
                      Step Condition (Optional - skips step if condition evaluates to false)
                    </span>
                    {step.conditionParsed && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStep(idx, { condition: null, conditionParsed: null })}
                        className="text-red-500 hover:text-red-700 text-[11px]"
                      >
                        Clear Condition
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <select
                        value={step.conditionParsed?.field || ''}
                        onChange={(e) => {
                          const f = e.target.value;
                          if (!f) {
                            handleUpdateStep(idx, { condition: null, conditionParsed: null });
                          } else {
                            handleUpdateStep(idx, {
                              conditionParsed: {
                                field: f,
                                op: step.conditionParsed?.op || 'eq',
                                value: step.conditionParsed?.value ?? '',
                              },
                            });
                          }
                        }}
                        className="w-full p-1.5 border border-gray-300 rounded bg-white text-xs"
                      >
                        <option value="">Always run (no condition)</option>
                        {fields.map((f) => (
                          <option key={f.name} value={f.name}>
                            When Field: {f.label} ({f.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    {step.conditionParsed?.field && (
                      <>
                        <div>
                          <select
                            value={step.conditionParsed.op}
                            onChange={(e) =>
                              handleUpdateStep(idx, {
                                conditionParsed: {
                                  ...step.conditionParsed!,
                                  op: e.target.value as WorkflowCondition['op'],
                                },
                              })
                            }
                            className="w-full p-1.5 border border-gray-300 rounded bg-white text-xs"
                          >
                            <option value="eq">equals (eq)</option>
                            <option value="neq">not equals (neq)</option>
                            <option value="gt">greater than (gt)</option>
                            <option value="gte">greater than or equal (gte)</option>
                            <option value="lt">less than (lt)</option>
                            <option value="lte">less than or equal (lte)</option>
                          </select>
                        </div>
                        <div>
                          <input
                            type="text"
                            value={String(step.conditionParsed.value ?? '')}
                            onChange={(e) =>
                              handleUpdateStep(idx, {
                                conditionParsed: {
                                  ...step.conditionParsed!,
                                  value: e.target.value,
                                },
                              })
                            }
                            placeholder="Target value..."
                            className="w-full p-1.5 border border-gray-300 rounded bg-white text-xs"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Form Preview */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Eye className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-bold text-gray-900">Live Form Preview</h2>
          <span className="text-xs text-gray-400 font-normal">
            (Interactive preview of how requesters will experience this form)
          </span>
        </div>

        {fields.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No fields to preview.</p>
        ) : (
          <div className="max-w-xl p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <DynamicForm
              fields={fields}
              onSubmit={(d) => alert(`Preview submitted: ${JSON.stringify(d, null, 2)}`)}
              submitButtonText="Preview Submit Button"
            />
          </div>
        )}
      </div>
    </form>
  );
};
