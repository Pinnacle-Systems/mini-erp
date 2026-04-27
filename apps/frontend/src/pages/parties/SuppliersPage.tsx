import {
  getLocalCustomers,
  getLocalSuppliers,
  queueCustomerCreate,
  queueCustomerDelete,
  type SupplierRow,
} from "../../features/sync/engine";
import { PartiesListPage } from "./PartiesListPage";
import { toUserSupplierErrorMessage } from "./customer-utils";

const addCustomerRole = async (
  tenantId: string,
  userId: string,
  row: SupplierRow,
) => {
  await queueCustomerCreate(
    tenantId,
    userId,
    {
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      gstNo: row.gstNo,
    },
    row.entityId,
  );
};

const removeCustomerRole = async (
  tenantId: string,
  userId: string,
  entityId: string,
) => {
  await queueCustomerDelete(tenantId, userId, entityId);
};

export function SuppliersPage() {
  return (
    <PartiesListPage
      title="Suppliers"
      description="Manage supplier master data from synced supplier records."
      singularLabel="Supplier"
      pluralLabel="Suppliers"
      addLabel="Add Supplier"
      addPath="/app/suppliers/new"
      detailBasePath="/app/suppliers"
      messageStateKey="supplierMessage"
      loadPrimaryRows={getLocalSuppliers}
      toUserErrorMessage={toUserSupplierErrorMessage}
      secondaryRole={{
        capability: "PARTIES_CUSTOMERS",
        label: "Customer",
        headerLabel: "Also Customer",
        loadRows: getLocalCustomers,
        addRole: addCustomerRole,
        removeRole: removeCustomerRole,
        addMessage: (name, isOffline) =>
          isOffline
            ? `${name} was queued to sync into customers.`
            : `${name} was added to customers.`,
        removeMessage: (name, isOffline) =>
          isOffline
            ? `${name} was queued to sync out of customers.`
            : `${name} was removed from customers.`,
      }}
    />
  );
}
