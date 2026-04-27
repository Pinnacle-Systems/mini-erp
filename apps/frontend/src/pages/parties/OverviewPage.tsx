import { ShoppingBag, UserRoundCog, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModuleOverview } from "../../design-system/organisms/ModuleOverview";

export function OverviewPage() {
  const navigate = useNavigate();

  return (
    <ModuleOverview
      title="Parties Overview"
      description="Open customer, supplier, and customer group records used across selling, buying, and finance flows."
      onOpen={navigate}
      primaryActions={[
        {
          label: "Customers",
          description: "Browse customers and open customer details.",
          to: "/app/customers",
          Icon: Users,
        },
        {
          label: "Customer Groups",
          description: "Maintain customer grouping for pricing and review.",
          to: "/app/customer-groups",
          Icon: UserRoundCog,
        },
        {
          label: "Suppliers",
          description: "Browse suppliers and open supplier details.",
          to: "/app/suppliers",
          Icon: ShoppingBag,
        },
      ]}
    />
  );
}
