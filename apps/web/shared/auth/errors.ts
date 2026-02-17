export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
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
