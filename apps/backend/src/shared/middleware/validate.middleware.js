import { catchAsync } from "../utils/catchAsync.js";

export const validateRequest = (schema) => (req, res, next) => {
  schema.parse({
    body: req.body,
    query: req.query,
    params: req.params,
  });
  next();
};
