import express, { json } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import apiRouter from "./route.js";
import { globalErrorHandler } from "./shared/middleware/error.middleware.js";
import { AppError } from "./shared/utils/errors.js";

const app = express();

app.set("trust proxy", 1);

app.use(cors());
app.use(json());
app.use(cookieParser());

app.use("/api", apiRouter);

app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// GLOBAL ERROR HANDLER (Must be last)
app.use(globalErrorHandler);

export default app;
