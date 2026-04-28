import type { Identity } from "../../generated/prisma/models";

declare global {
  namespace Express {
    type AuthenticatedUser = Identity & {
      tenantId?: string;
      memberRole?: string;
      locationId?: string | null;
    };

    interface Request {
      user?: AuthenticatedUser;
      session?: {
        id?: string;
      };
    }
  }
}

export {};
