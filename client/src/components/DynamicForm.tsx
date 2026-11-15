import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { FormField } from '../api/types';

interface DynamicFormProps {
  fields: FormField[];
  initialValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitButtonText?: string;
  isSubmitting?: boolean;
  extraButtons?: React.ReactNode;
  disabled?: boolean;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  fields,
  initialValues = {},
  onSubmit,
  submitButtonText = 'Submit',
  isSubmitting = false,
  extraButtons,
  disabled = false,
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: initialValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {fields.map((field) => {
        const error = errors[field.name];

        return (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === 'text' && (
              <input
                type="text"
                disabled={disabled}
                placeholder={field.placeholder}
                className="w-full text-sm rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                {...register(field.name, {
                  required: field.required ? `${field.label} is required` : false,
                })}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                rows={4}
                disabled={disabled}
                placeholder={field.placeholder}
                className="w-full text-sm rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                {...register(field.name, {
                  required: field.required ? `${field.label} is required` : false,
                })}
              />
            )}

            {field.type === 'number' && (
              <input
                type="number"
                step="any"
                disabled={disabled}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                className="w-full text-sm rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                {...register(field.name, {
                  required: field.required ? `${field.label} is required` : false,
                  valueAsNumber: true,
                  min: field.min !== undefined ? { value: field.min, message: `Minimum value is ${field.min}` } : undefined,
                  max: field.max !== undefined ? { value: field.max, message: `Maximum value is ${field.max}` } : undefined,
                })}
              />
            )}

            {field.type === 'date' && (
              <input
                type="date"
                disabled={disabled}
                className="w-full text-sm rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                {...register(field.name, {
                  required: field.required ? `${field.label} is required` : false,
                })}
              />
            )}

            {field.type === 'select' && (
              <select
                disabled={disabled}
                className="w-full text-sm rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
                {...register(field.name, {
                  required: field.required ? `${field.label} is required` : false,
                })}
              >
                <option value="">-- Select {field.label} --</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'checkbox' && (
              <div className="flex items-center mt-2">
                <Controller
                  name={field.name}
                  control={control}
                  rules={{
                    required: field.required ? `${field.label} must be checked` : false,
                  }}
                  render={({ field: { onChange, value } }) => (
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={Boolean(value)}
                      onChange={(e) => onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:bg-gray-100"
                    />
                  )}
                />
                <span className="ml-2 text-sm text-gray-600">{field.placeholder || 'I confirm'}</span>
              </div>
            )}

            {error && (
              <p className="mt-1 text-xs text-red-600">{error.message as string}</p>
            )}
          </div>
        );
      })}

      <div className="pt-4 flex items-center gap-3">
        {extraButtons}
        <button
          type="submit"
          disabled={disabled || isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : submitButtonText}
        </button>
      </div>
    </form>
  );
};

