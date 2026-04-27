import { Boxes, ClipboardList, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModuleOverview } from "../../design-system/organisms/ModuleOverview";

export function OverviewPage() {
  const navigate = useNavigate();

  return (
    <ModuleOverview
      title="Stock Overview"
      description="Review stock position, enter adjustments, and inspect stock movement history."
      onOpen={navigate}
      primaryActions={[
        {
          label: "Levels",
          description: "Review current stock quantities and location context.",
          to: "/app/stock-levels",
          Icon: Boxes,
        },
        {
          label: "Adjustments",
          description: "Record stock coming in or going out.",
          to: "/app/stock-adjustments",
          Icon: ClipboardList,
        },
        {
          label: "History",
          description: "Inspect recent stock movement records.",
          to: "/app/stock-history",
          Icon: History,
        },
      ]}
    />
  );
}
