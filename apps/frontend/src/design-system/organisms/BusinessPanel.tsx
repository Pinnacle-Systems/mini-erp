import type { AssignedStore } from "../../features/auth/session-business";
import { Button } from "../atoms/Button";
import { Select } from "../atoms/Select";
import { Card, CardContent } from "../molecules/Card";

type BusinessPanelProps = {
  businesses: AssignedStore[];
  activeStore: string | null;
  currentBusinessReminder: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  onBusinessChange: (businessId: string) => void;
  onApplyBusinessToken: () => void;
};

export function BusinessPanel({
  businesses,
  activeStore,
  currentBusinessReminder,
  loading,
  isAuthenticated,
  onBusinessChange,
  onApplyBusinessToken
}: BusinessPanelProps) {
  return (
    <Card>
      <CardContent className="space-y-3">
        {currentBusinessReminder ? (
          <p className="text-sm text-muted-foreground">
            Currently on:{" "}
            <span className="font-medium text-foreground">{currentBusinessReminder}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
        <Select
          value={activeStore ?? ""}
          onChange={(event) => onBusinessChange(event.target.value)}
          disabled={!isAuthenticated || businesses.length === 0}
          className="min-w-[240px]"
        >
          <option value="" disabled>
            Select business
          </option>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          disabled={!activeStore || loading || !isAuthenticated}
          onClick={onApplyBusinessToken}
        >
          Select Business
        </Button>
        </div>
      </CardContent>
    </Card>
  );
}
