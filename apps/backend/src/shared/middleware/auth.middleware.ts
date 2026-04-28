import { getIdentity } from "../../modules/auth/auth.public.js";
import { catchAsync } from "../utils/catchAsync.js";
import { UnauthorizedError } from "../utils/errors.js";
import { verifyAccessToken } from "../utils/token.utils.js";

export const protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new UnauthorizedError("You are not logged in"));
  }

  const decoded = await verifyAccessToken(token);

  const currentUser = await getIdentity(decoded.sub);

  if (!currentUser) {
    return next(new UnauthorizedError("User does not exist"));
  }

  // TODO: block if password was changed after the token was issued

  req.user = {
    ...currentUser,
    tenantId: typeof decoded.tenantId === "string" ? decoded.tenantId : undefined,
    memberRole: typeof decoded.memberRole === "string" ? decoded.memberRole : undefined,
    locationId:
      typeof decoded.locationId === "string"
        ? decoded.locationId
        : decoded.locationId === null
          ? null
          : undefined,
  };
  req.session = { id: decoded.sid };
  next();
});
