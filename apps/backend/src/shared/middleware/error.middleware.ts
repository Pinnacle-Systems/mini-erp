import { ZodError } from "zod";

const INTERNAL_ERROR_MESSAGE = "Something went wrong. Please try again.";

const logUnexpectedError = (err) => {
  if (!err?.isOperational) {
    console.error("ERROR", err);
  }
};

export const globalErrorHandler = (err, req, res, _next) => {
  err.statusCode = err.statusCode ?? 500;
  err.status = err.status ?? "error";

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      status: "error",
      message: "Validation failed",
      errors: err.issues.map((error) => ({
        path: error.path,
        message: error.message,
      })),
    });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      ...(typeof err.reasonCode === "string" ? { reasonCode: err.reasonCode } : {}),
      ...(err.details && typeof err.details === "object" ? { details: err.details } : {}),
    });
  }

  logUnexpectedError(err);
  return res.status(500).json({
    success: false,
    status: "error",
    message: INTERNAL_ERROR_MESSAGE,
  });
};
