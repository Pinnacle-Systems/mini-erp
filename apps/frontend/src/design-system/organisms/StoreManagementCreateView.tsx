import { Button } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Label } from "../atoms/Label";

type StoreManagementCreateViewProps = {
  loading: boolean;
  error: string | null;
  newStoreName: string;
  newOwnerPhone: string;
  onNewStoreNameChange: (value: string) => void;
  onNewOwnerPhoneChange: (value: string) => void;
  onCreate: () => void;
  onBackToList: () => void;
};

export function StoreManagementCreateView({
  loading,
  error,
  newStoreName,
  newOwnerPhone,
  onNewStoreNameChange,
  onNewOwnerPhoneChange,
  onCreate,
  onBackToList,
}: StoreManagementCreateViewProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-store-name">Store name</Label>
          <Input
            id="new-store-name"
            value={newStoreName}
            onChange={(event) => onNewStoreNameChange(event.target.value)}
            placeholder="Downtown Outlet"
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-owner-phone">Owner phone (primary)</Label>
          <Input
            id="new-owner-phone"
            value={newOwnerPhone}
            onChange={(event) => onNewOwnerPhoneChange(event.target.value)}
            placeholder="10 digit phone"
            disabled={loading}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        If no owner identity exists for the phone, a new identity is created
        with the default password.
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onCreate}
          disabled={loading || !newStoreName.trim() || !newOwnerPhone.trim()}
        >
          Create Store
        </Button>
        <Button variant="outline" onClick={onBackToList} disabled={loading}>
          Cancel
        </Button>
      </div>
    </>
  );
}
