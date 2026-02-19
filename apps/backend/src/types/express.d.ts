import type { Identity } from "../../generated/prisma/models";

declare global {
  namespace Express {
    interface Request {
      user?: Identity;
      session?: {
        id?: string;
      };
    }
  }
}

export {};
