import * as jose from "jose";
import { UnauthorizedError } from "./errors.js";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const alg = "HS256";
const issuer = "pinnacle-systems-erp";

export const signAccessToken = async (
  identity,
  session,
  additionalPayload = {},
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

export const signTempToken = async (identity, session) => {
  return new jose.SignJWT({
    sid: session.id,
    systemRole: identity.system_role,
    scope: "BUSINESS_SELECTION",
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(issuer)
    .setSubject(identity.id)
    .setExpirationTime("10m")
    .sign(JWT_SECRET);
};

export const verifyAccessToken = async (token) => {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      issuer,
      algorithms: [alg],
    });

    return payload;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code === "ERR_JWT_EXPIRED") {
        throw new UnauthorizedError("Access token expired");
      }
      if (code.startsWith("ERR_JWT_")) {
        throw new UnauthorizedError("Invalid access token");
      }
    }

    throw new UnauthorizedError("Unauthorized");
  }
};
