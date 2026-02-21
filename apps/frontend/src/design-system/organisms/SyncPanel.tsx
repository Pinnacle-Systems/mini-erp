import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../molecules/Card";

type SyncPanelProps = {
  sku: string;
  name: string;
  description: string;
  localItems: string[];
  loading: boolean;
  isAuthenticated: boolean;
  activeStore: string | null;
  isStoreSelected: boolean;
  onSkuChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onQueueItemCreate: () => void;
  onSyncNow: () => void;
};

export function SyncPanel({
  sku,
  name,
  description,
  localItems,
  loading,
  isAuthenticated,
  activeStore,
  isStoreSelected,
  onSkuChange,
  onNameChange,
  onDescriptionChange,
  onQueueItemCreate,
  onSyncNow
}: SyncPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Item Sync</CardTitle>
        <CardDescription>Queue and sync item mutations for the active store.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input value={sku} onChange={(event) => onSkuChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(event) => onNameChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            disabled={loading || !isAuthenticated || !activeStore || !isStoreSelected}
            onClick={onQueueItemCreate}
          >
            Queue Item Create
          </Button>
          <Button
            variant="outline"
            disabled={loading || !isAuthenticated || !activeStore || !isStoreSelected}
            onClick={onSyncNow}
          >
            Sync Now
          </Button>
        </div>
        {!isStoreSelected ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Select a store and apply the store token to enable sync.
          </p>
        ) : null}

        <div className="mt-5">
          <p className="text-xs font-medium tracking-[0.01em] text-muted-foreground">Local items</p>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            {localItems.map((item) => (
              <li key={item} className="rounded-xl border border-white/80 bg-white/65 px-3 py-1.5">
                {item}
              </li>
            ))}
            {localItems.length === 0 ? <li className="text-muted-foreground">No local items synced yet.</li> : null}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
