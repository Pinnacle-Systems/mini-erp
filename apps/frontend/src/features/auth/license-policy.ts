import type { AssignedStore } from "./session-business";

const OFFLINE_LICENSE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const toDateOnlyUtc = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getTodayUtcDateOnly = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

export const canSwitchStoreOffline = (
  business: AssignedStore | undefined,
): { allowed: boolean; reason?: string } => {
  if (!business) {
    return { allowed: false, reason: "Selected store was not found." };
  }

  const license = business.license;
  if (!license) {
    return { allowed: false, reason: "No cached license is available for this store." };
  }

  const beginDate = toDateOnlyUtc(license.beginsOn);
  const endDate = toDateOnlyUtc(license.endsOn);
  if (!beginDate || !endDate) {
    return { allowed: false, reason: "Cached license dates are invalid. Connect online to refresh." };
  }

  const today = getTodayUtcDateOnly();
  if (today < beginDate || today > endDate) {
    return { allowed: false, reason: "Cached license is not active for today's date." };
  }

  const fetchedAt = new Date(license.fetchedAt);
  if (Number.isNaN(fetchedAt.getTime())) {
    return { allowed: false, reason: "Cached license metadata is invalid. Connect online to refresh." };
  }

  if (Date.now() - fetchedAt.getTime() > OFFLINE_LICENSE_MAX_AGE_MS) {
    return { allowed: false, reason: "Cached license is stale. Connect online to validate the store." };
  }

  return { allowed: true };
};
