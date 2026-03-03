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

export const toUserCustomerErrorMessage = (error: unknown) => {
  const rejection = getSyncRejectionFromError(error);
  if (
    rejection?.reasonCode === "VERSION_CONFLICT" &&
    rejection.entity === "customer"
  ) {
    return "This customer changed on another device. Refresh and apply your edits again.";
  }
  if (
    rejection?.reasonCode === "DEPENDENCY_MISSING" &&
    rejection.entity === "customer"
  ) {
    return "This customer is no longer available. Refresh and select another row.";
  }
  if (!(error instanceof Error)) {
    return "Unable to save customers right now.";
  }

  return error.message || "Unable to save customers right now.";
};
