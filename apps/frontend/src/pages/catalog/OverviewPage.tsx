import { Boxes, FolderKanban, Package, PackageSearch } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModuleOverview } from "../../design-system/organisms/ModuleOverview";

export function OverviewPage() {
  const navigate = useNavigate();

  return (
    <ModuleOverview
      title="Catalog Overview"
      description="Maintain products, services, categories, and collections used by sales, purchases, and stock workflows."
      onOpen={navigate}
      primaryActions={[
        {
          label: "Products",
          description: "Manage product items, variants, and pricing fields.",
          to: "/app/products",
          Icon: Package,
        },
        {
          label: "Services",
          description: "Maintain service items for billing workflows.",
          to: "/app/services",
          Icon: Package,
        },
      ]}
      secondaryActions={[
        {
          label: "Categories",
          description: "Organize catalog items into operational groups.",
          to: "/app/item-categories",
          Icon: Boxes,
        },
        {
          label: "Collections",
          description: "Group items for browsing and maintenance.",
          to: "/app/item-collections",
          Icon: PackageSearch,
        },
        {
          label: "Item Sync",
          description: "Review local item sync utilities.",
          to: "/app/admin-item-sync",
          Icon: FolderKanban,
        },
      ]}
    />
  );
}
