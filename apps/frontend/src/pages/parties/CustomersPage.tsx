import {
  getLocalCustomers,
  getLocalSuppliers,
  queueSupplierCreate,
  queueSupplierDelete,
  type CustomerRow,
} from "../../features/sync/engine";
import { PartiesListPage } from "./PartiesListPage";
import { toUserCustomerErrorMessage } from "./customer-utils";

const addSupplierRole = async (
  tenantId: string,
  userId: string,
  row: CustomerRow,
) => {
  await queueSupplierCreate(
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

const removeSupplierRole = async (
  tenantId: string,
  userId: string,
  entityId: string,
) => {
  await queueSupplierDelete(tenantId, userId, entityId);
};

export function CustomersPage() {
  return (
    <PartiesListPage
      title="Customers"
      description="Manage customer master data from synced customer records."
      singularLabel="Customer"
      pluralLabel="Customers"
      addLabel="Add Customer"
      addPath="/app/customers/new"
      detailBasePath="/app/customers"
      messageStateKey="customerMessage"
      loadPrimaryRows={getLocalCustomers}
      toUserErrorMessage={toUserCustomerErrorMessage}
      secondaryRole={{
        capability: "PARTIES_SUPPLIERS",
        label: "Supplier",
        headerLabel: "Also Supplier",
        loadRows: getLocalSuppliers,
        addRole: addSupplierRole,
        removeRole: removeSupplierRole,
        addMessage: (name, isOffline) =>
          isOffline
            ? `${name} was queued to sync into suppliers.`
            : `${name} was added to suppliers.`,
        removeMessage: (name, isOffline) =>
          isOffline
            ? `${name} was queued to sync out of suppliers.`
            : `${name} was removed from suppliers.`,
      }}
    />
  );
}
