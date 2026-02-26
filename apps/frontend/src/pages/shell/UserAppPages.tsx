import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../design-system/molecules/Card";
import { SettingsPanel } from "../../design-system/organisms/SettingsPanel";
import { SyncPanel } from "../../design-system/organisms/SyncPanel";
import { useSessionStore } from "../../features/auth/session-business";
import { useSyncActions } from "../../features/sync/SyncProvider";
import { useUserAppStore } from "../../features/sync/user-app-business";
import { getPendingOutboxCount, resetTenantSyncState } from "../../features/sync/engine";

type AppFeaturePlaceholderPageProps = {
  sectionTitle: string;
  appLabel: string;
};

export function AppFeaturePlaceholderPage({ sectionTitle, appLabel }: AppFeaturePlaceholderPageProps) {
  const businesses = useSessionStore((state) => state.businesses);
  const activeStore = useSessionStore((state) => state.activeStore);
  const activeBusinessName = useMemo(
    () =>
      businesses.find((business) => business.id === activeStore)?.name ??
      "No business selected",
    [activeStore, businesses],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sectionTitle}</CardTitle>
        <CardDescription>
          <strong>{activeBusinessName}</strong> {sectionTitle.toLowerCase()} app: {appLabel}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">App content will be added here.</p>
      </CardContent>
    </Card>
  );
}

export function StockSyncAppPage() {
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const sku = useUserAppStore((state) => state.sku);
  const name = useUserAppStore((state) => state.name);
  const localItems = useUserAppStore((state) => state.localItems);
  const setSku = useUserAppStore((state) => state.setSku);
  const setName = useUserAppStore((state) => state.setName);
  const { loading, onQueueItemCreate, onSyncNow } = useSyncActions();

  return (
    <SyncPanel
      sku={sku}
      name={name}
      localItems={localItems}
      loading={loading}
      isAuthenticated={Boolean(identityId)}
      activeStore={activeStore}
      isBusinessSelected={isBusinessSelected}
      onSkuChange={setSku}
      onNameChange={setName}
      onQueueItemCreate={onQueueItemCreate}
      onSyncNow={onSyncNow}
    />
  );
}

export function DataSyncAppPage() {
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isBusinessSelected = useSessionStore((state) => state.isBusinessSelected);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [resyncing, setResyncing] = useState(false);
  const { loading, onSyncNow } = useSyncActions();

  useEffect(() => {
    if (!activeStore || !isBusinessSelected) {
      setPendingOutboxCount(0);
      return;
    }

    let cancelled = false;
    void getPendingOutboxCount(activeStore)
      .then((count) => {
        if (!cancelled) {
          setPendingOutboxCount(count);
        }
      })
      .catch((error: unknown) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [activeStore, isBusinessSelected, loading, resyncing]);

  const onResync = async () => {
    if (!activeStore || !isBusinessSelected || resyncing) {
      return;
    }

    const pendingWarning =
      pendingOutboxCount > 0
        ? `Warning: ${pendingOutboxCount} pending outbox item${pendingOutboxCount === 1 ? "" : "s"} will be deleted and data will be lost.\n\n`
        : "";

    const confirmed = window.confirm(
      `${pendingWarning}This clears local sync data for the active business and pulls a fresh copy from server. Continue?`,
    );
    if (!confirmed) {
      return;
    }

    setResyncing(true);
    try {
      await resetTenantSyncState(activeStore);
      await onSyncNow();
    } catch (error) {
      console.error(error);
    } finally {
      setResyncing(false);
    }
  };

  return (
    <SettingsPanel
      pendingOutboxCount={pendingOutboxCount}
      loading={resyncing || loading}
      disabled={!identityId || !activeStore || !isBusinessSelected}
      onResync={() => {
        void onResync();
      }}
    />
  );
}
