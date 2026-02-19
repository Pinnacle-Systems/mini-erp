import type { AssignedStore } from "../../features/auth/store-context";
import { Button } from "../atoms/Button";
import { Select } from "../atoms/Select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../molecules/Card";

type StorePanelProps = {
  stores: AssignedStore[];
  activeStore: string | null;
  activeStoreName: string;
  loading: boolean;
  isAuthenticated: boolean;
  onStoreChange: (storeId: string) => void;
  onApplyStoreToken: () => void;
};

export function StorePanel({
  stores,
  activeStore,
  activeStoreName,
  loading,
  isAuthenticated,
  onStoreChange,
  onApplyStoreToken
}: StorePanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Store Context</CardTitle>
        <CardDescription>
          Active: {activeStoreName}. Tenant users must select a store and apply token.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
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
          Apply Store Token
        </Button>
      </CardContent>
    </Card>
  );
}
