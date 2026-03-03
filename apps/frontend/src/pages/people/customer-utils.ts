import {
  getSyncRejectionFromError,
  type CustomerInput,
  type CustomerRow,
} from "../../features/sync/engine";

export type CustomerDraft = CustomerInput;

export const EMPTY_CUSTOMER_DRAFT: CustomerDraft = {
  name: "",
  phone: "",
  email: "",
  address: "",
  gstNo: "",
};

export const toCustomerDraft = (customer: CustomerRow): CustomerDraft => ({
  name: customer.name,
  phone: customer.phone,
  email: customer.email,
  address: customer.address,
  gstNo: customer.gstNo,
});

export const toUserPartyErrorMessage = (
  error: unknown,
  entity: "customer" | "supplier",
  label: string,
) => {
  const rejection = getSyncRejectionFromError(error);
  if (rejection?.reasonCode === "VERSION_CONFLICT" && rejection.entity === entity) {
    return `This ${label} changed on another device. Refresh and apply your edits again.`;
  }
  if (rejection?.reasonCode === "DEPENDENCY_MISSING" && rejection.entity === entity) {
    return `This ${label} is no longer available. Refresh and select another row.`;
  }
  if (rejection?.reasonCode === "PERMISSION_DENIED" && rejection.entity === entity) {
    return `This business is not licensed to manage ${label}s.`;
  }
  if (!(error instanceof Error)) {
    return `Unable to save ${label}s right now.`;
  }

  return error.message || `Unable to save ${label}s right now.`;
};

export const toUserCustomerErrorMessage = (error: unknown) =>
  toUserPartyErrorMessage(error, "customer", "customer");

export const toUserSupplierErrorMessage = (error: unknown) =>
  toUserPartyErrorMessage(error, "supplier", "supplier");
