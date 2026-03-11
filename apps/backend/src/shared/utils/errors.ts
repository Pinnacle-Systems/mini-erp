export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  reasonCode?: string;
  details?: Record<string, unknown>;

  constructor(
    message,
    statusCode,
    options?: {
      reasonCode?: string;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.reasonCode = options?.reasonCode;
    this.details = options?.details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid input") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Invalid credentials") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "Resource already exists",
    options?: {
      reasonCode?: string;
      details?: Record<string, unknown>;
    },
  ) {
    super(message, 409, options);
  }
}
