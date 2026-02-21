import type { AssignedStore } from "../../features/auth/session-store";
import { Button } from "../atoms/Button";
import { Select } from "../atoms/Select";
import { Card, CardContent } from "../molecules/Card";

type StorePanelProps = {
  stores: AssignedStore[];
  activeStore: string | null;
  currentStoreReminder: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  onStoreChange: (storeId: string) => void;
  onApplyStoreToken: () => void;
};

export function StorePanel({
  stores,
  activeStore,
  currentStoreReminder,
  loading,
  isAuthenticated,
  onStoreChange,
  onApplyStoreToken
}: StorePanelProps) {
  return (
    <Card>
      <CardContent className="space-y-3">
        {currentStoreReminder ? (
          <p className="text-sm text-muted-foreground">
            Currently on:{" "}
            <span className="font-medium text-foreground">{currentStoreReminder}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
        <Select
          value={activeStore ?? ""}
          onChange={(event) => onStoreChange(event.target.value)}
          disabled={!isAuthenticated || stores.length === 0}
          className="min-w-[240px]"
        >
          <option value="" disabled>
            Select store
          </option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          disabled={!activeStore || loading || !isAuthenticated}
          onClick={onApplyStoreToken}
        >
          Select Store
        </Button>
        </div>
      </CardContent>
    </Card>
  );
}
