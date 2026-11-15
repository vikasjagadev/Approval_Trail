import { z, ZodTypeAny } from 'zod';
import { AppError } from '../utils/errors.js';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export function buildZodSchema(fields: FormField[], requestTypeKey?: string) {
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of fields) {
    let schema: ZodTypeAny;

    switch (field.type) {
      case 'text':
      case 'textarea':
        if (field.required) {
          schema = z.string().trim().min(1, `${field.label} is required`);
        } else {
          schema = z.string().trim().optional().or(z.literal(''));
        }
        break;

      case 'number':
        if (field.required) {
          let num = z.coerce.number({ invalid_type_error: `${field.label} must be a number` });
          if (field.min !== undefined) {
            num = num.min(field.min, `${field.label} must be at least ${field.min}`);
          }
          if (field.max !== undefined) {
            num = num.max(field.max, `${field.label} must be at most ${field.max}`);
          }
          schema = num;
        } else {
          let num: ZodTypeAny = z.coerce.number().optional();
          if (field.min !== undefined) {
            num = num.refine((val) => val === undefined || (typeof val === 'number' && val >= field.min!), {
              message: `${field.label} must be at least ${field.min}`,
            });
          }
          if (field.max !== undefined) {
            num = num.refine((val) => val === undefined || (typeof val === 'number' && val <= field.max!), {
              message: `${field.label} must be at most ${field.max}`,
            });
          }
          schema = num;
        }
        break;

      case 'date':
        // Dates are YYYY-MM-DD strings
        if (field.required) {
          schema = z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, `${field.label} must be a valid date in YYYY-MM-DD format`);
        } else {
          schema = z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, `${field.label} must be a valid date in YYYY-MM-DD format`)
            .optional()
            .or(z.literal(''));
        }
        break;

      case 'select':
        if (field.required) {
          if (field.options && field.options.length > 0) {
            schema = z.enum(field.options as [string, ...string[]], {
              errorMap: () => ({ message: `${field.label} must be one of: ${field.options?.join(', ')}` }),
            });
          } else {
            schema = z.string().min(1, `${field.label} is required`);
          }
        } else {
          if (field.options && field.options.length > 0) {
            schema = z
              .enum(field.options as [string, ...string[]])
              .optional()
              .or(z.literal(''));
          } else {
            schema = z.string().optional().or(z.literal(''));
          }
        }
        break;

      case 'checkbox':
        if (field.required) {
          schema = z.boolean().refine((val) => val === true, `${field.label} must be checked`);
        } else {
          schema = z.boolean().default(false);
        }
        break;

      default:
        schema = z.unknown();
        break;
    }

    shape[field.name] = schema;
  }

  let objectSchema = z.object(shape).strict();

  if (requestTypeKey === 'LEAVE' && shape.startDate && shape.endDate) {
    objectSchema = objectSchema.refine(
      (data: Record<string, unknown>) => {
        if (typeof data.startDate === 'string' && typeof data.endDate === 'string') {
          return data.endDate >= data.startDate;
        }
        return true;
      },
      {
        message: 'End date must be on or after start date',
        path: ['endDate'],
      }
    ) as unknown as typeof objectSchema;
  }

  return objectSchema;
}

export function validateFormData(
  fields: FormField[],
  data: unknown,
  requestTypeKey?: string
): Record<string, unknown> {
  const schema = buildZodSchema(fields, requestTypeKey);
  const result = schema.safeParse(data);

  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    throw AppError.validationError('Form validation failed', details);
  }

  return result.data as Record<string, unknown>;
}

