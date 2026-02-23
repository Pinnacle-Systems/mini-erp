import { Button } from "../atoms/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../molecules/Card";

type SettingsPanelProps = {
  loading: boolean;
  disabled: boolean;
  pendingOutboxCount: number;
  onResync: () => void;
};

export function SettingsPanel({
  loading,
  disabled,
  pendingOutboxCount,
  onResync,
}: SettingsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Reset local sync data and pull a fresh copy from the server for the active store.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingOutboxCount > 0 ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Warning: {pendingOutboxCount} pending outbox item
            {pendingOutboxCount === 1 ? "" : "s"} will be deleted and cannot be recovered.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No pending outbox items detected for the active store.
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          disabled={disabled || loading}
          onClick={onResync}
        >
          {loading ? "Re-syncing..." : "Re-sync Local Data"}
        </Button>
      </CardContent>
    </Card>
  );
}
