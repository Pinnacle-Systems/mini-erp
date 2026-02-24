import express, { json } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import apiRouter from "./route.js";
import { globalErrorHandler } from "./shared/middleware/error.middleware.js";
import { AppError } from "./shared/utils/errors.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = resolve(__dirname, "../uploads");

app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ?? true,
    credentials: true,
  }),
);
app.use(json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));

app.use("/api", apiRouter);

app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// GLOBAL ERROR HANDLER (Must be last)
app.use(globalErrorHandler);

export default app;
