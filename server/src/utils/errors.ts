export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: unknown[];

  constructor(code: ErrorCode, statusCode: number, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static validationError(message: string, details: unknown[] = []): AppError {
    return new AppError('VALIDATION_ERROR', 400, message, details);
  }

  static unauthenticated(message = 'Authentication required'): AppError {
    return new AppError('UNAUTHENTICATED', 401, message);
  }

  static forbidden(message = 'Access denied'): AppError {
    return new AppError('FORBIDDEN', 403, message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError('NOT_FOUND', 404, message);
  }

  static conflict(message = 'Conflict'): AppError {
    return new AppError('CONFLICT', 409, message);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError('INTERNAL', 500, message);
  }
}

