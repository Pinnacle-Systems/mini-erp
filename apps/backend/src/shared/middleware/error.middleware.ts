import { ZodError } from "zod";

export const globalErrorHandler = (err, req, res, _next) => {
  err.statusCode = err.statusCode ?? 500;
  err.status = err.status ?? "error";

  if (process.env.NODE_ENV === "development") {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }

  // AppError
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  }

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

  console.error("ERROR 💥", err);
  return res.status(500).json({
    success: false,
    status: "error",
    message: "Something went very wrong!",
  });
};
