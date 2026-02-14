import * as jose from "jose";

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
    scope: "STORE_SELECTION",
  })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(issuer)
    .setSubject(identity.id)
    .setExpirationTime("10m")
    .sign(JWT_SECRET);
};

export const verifyAccessToken = async (token) => {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
    issuer,
    algorithms: [alg],
  });

  return payload;
};
