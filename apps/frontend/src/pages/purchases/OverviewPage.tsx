import { ClipboardList, FileText, ReceiptText, Undo2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModuleOverview } from "../../design-system/organisms/ModuleOverview";

export function OverviewPage() {
  const navigate = useNavigate();

  return (
    <ModuleOverview
      title="Purchases Overview"
      description="Open supplier ordering, receiving, invoice, and return workflows from one module entry point."
      onOpen={navigate}
      primaryActions={[
        {
          label: "Orders",
          description: "Prepare and review purchase orders.",
          to: "/app/purchase-orders",
          Icon: ClipboardList,
        },
        {
          label: "Goods Receipts",
          description: "Record and inspect received supplier goods.",
          to: "/app/goods-receipt-notes",
          Icon: ReceiptText,
        },
        {
          label: "Invoices",
          description: "Create and review purchase invoices.",
          to: "/app/purchase-invoices",
          Icon: FileText,
        },
        {
          label: "Returns",
          description: "Manage purchase returns to suppliers.",
          to: "/app/purchase-returns",
          Icon: Undo2,
        },
      ]}
    />
  );
}
