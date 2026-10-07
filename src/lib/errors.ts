/** Application error taxonomy. Every thrown error carries an HTTP status. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
    readonly code: string = 'INTERNAL_ERROR',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The submitted data is invalid.', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'You must sign in to continue.') {
    super(message, 401, 'UNAUTHENTICATED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Record') {
    super(`${entity} was not found.`, 404, 'NOT_FOUND');
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super('Too many requests. Please slow down.', 429, 'RATE_LIMITED', { retryAfterSeconds });
  }
}

/** Raised when an external integration fails; callers degrade gracefully. */
export class IntegrationError extends AppError {
  constructor(
    readonly provider: string,
    message: string,
    readonly retryable = true,
  ) {
    super(message, 502, 'INTEGRATION_ERROR', { provider, retryable });
  }
}
