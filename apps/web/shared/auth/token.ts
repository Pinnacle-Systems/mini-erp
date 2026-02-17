import * as jose from "jose";
import { SystemRole } from "../../generated/prisma/enums";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const alg = "HS256";
const issuer = "pinnacle-systems-erp";

type IdentityLike = {
  id: string;
  system_role: SystemRole;
};

type SessionLike = {
  id: string;
};

export const signAccessToken = async (
  identity: IdentityLike,
  session: SessionLike,
  additionalPayload: Record<string, unknown> = {},
) => {
  return new jose.SignJWT({
    sid: session.id,
    systemRole: identity.system_role,
    ...additionalPayload,
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(issuer)
    .setSubject(identity.id)
    .setExpirationTime("10m")
    .sign(JWT_SECRET);
};

export const signTempToken = async (
  identity: IdentityLike,
  session: SessionLike,
) => {
  return new jose.SignJWT({
    sid: session.id,
    systemRole: identity.system_role,
    scope: "STORE_SELECTION",
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(issuer)
    .setSubject(identity.id)
    .setExpirationTime("10m")
    .sign(JWT_SECRET);
};
