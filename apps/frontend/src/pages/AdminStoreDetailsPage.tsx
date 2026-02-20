import { ArrowLeft, Save, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { IconButton } from "../design-system/atoms/IconButton";
import { Input } from "../design-system/atoms/Input";
import { Label } from "../design-system/atoms/Label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../design-system/molecules/Card";
import { deleteAdminStore, getAdminStore, updateAdminStore, type AdminStore } from "../features/admin/stores";

type AdminStoreDetailsPageProps = {
  onStoreMutated: () => void;
};

export function AdminStoreDetailsPage({ onStoreMutated }: AdminStoreDetailsPageProps) {
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const [store, setStore] = useState<AdminStore | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStore = async () => {
    if (!storeId) {
      setError("Store not found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getAdminStore(storeId);
      setStore(result);
      setNameDraft(result.name);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load store");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStore();
  }, [storeId]);

  const runMutation = async (operation: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await operation();
      onStoreMutated();
      await loadStore();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update store");
    } finally {
      setSaving(false);
    }
  };

  const onSaveName = async () => {
    if (!storeId || !nameDraft.trim()) {
      setError("Store name is required.");
      return;
    }
    await runMutation(async () => {
      await updateAdminStore(storeId, { name: nameDraft.trim() });
    });
  };

  const onDelete = async () => {
    if (!storeId) return;
    await runMutation(async () => {
      await deleteAdminStore(storeId);
    });
  };

  const onRestore = async () => {
    if (!storeId) return;
    await runMutation(async () => {
      await updateAdminStore(storeId, { isActive: true });
    });
  };

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl p-6 md:p-10">
      <IconButton
        icon={ArrowLeft}
        type="button"
        variant="outline"
        onClick={() => navigate("/app/stores")}
        className="absolute right-[5.25rem] top-10 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/75 text-foreground shadow-sm backdrop-blur hover:bg-white md:right-[6.25rem] md:top-14"
        aria-label="Back to stores list"
        title="Back"
      />
      <IconButton
        icon={X}
        type="button"
        variant="outline"
        onClick={() => navigate("/app")}
        className="absolute right-10 top-10 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/75 text-foreground shadow-sm backdrop-blur hover:bg-white md:right-14 md:top-14"
        aria-label="Close manage stores"
        title="Close"
      />

      <Card>
        <CardHeader>
          <CardTitle>Store Details</CardTitle>
          <CardDescription>Manage store metadata and lifecycle state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading store details...</p>
          ) : !store ? (
            <p className="text-sm text-muted-foreground">Store not found.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="store-name">Store name</Label>
                  <Input
                    id="store-name"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner phone</Label>
                  <p className="text-sm text-muted-foreground">
                    {store.owner?.phone ?? "Owner phone unavailable"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 bg-white/55 p-3">
                <p className="text-xs text-muted-foreground">
                  Status:{" "}
                  <span className={store.deletedAt ? "font-semibold text-red-700" : "font-semibold text-green-700"}>
                    {store.deletedAt ? "Deleted" : "Active"}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={onSaveName} disabled={saving || !nameDraft.trim()} className="gap-1">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save Name
                </Button>
                {store.deletedAt ? (
                  <Button variant="outline" onClick={onRestore} disabled={saving} className="gap-1">
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    Restore Store
                  </Button>
                ) : (
                  <Button variant="outline" onClick={onDelete} disabled={saving} className="gap-1 text-red-700">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete Store
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
