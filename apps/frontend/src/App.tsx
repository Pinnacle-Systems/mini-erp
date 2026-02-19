import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getMe, login, selectStore } from "./features/auth/client";
import {
  getAssignedStores,
  clearStoreContext,
  setActiveStore,
  type AssignedStore
} from "./features/auth/store-context";
import { getLocalProducts, queueProductCreate, syncOnce } from "./features/sync/engine";
import { LoginPage } from "./pages/LoginPage";
import { AppHomePage } from "./pages/AppHomePage";
import IosFolder from "./pages/test.jsx";
import type { FolderId } from "./design-system/organisms/AppFolderLauncher";
import {
  createAdminStore,
  deleteAdminStore,
  listAdminStores,
  updateAdminStore,
  type AdminStoresPagination,
  type AdminStore
} from "./features/admin/stores";
import { AdminHomePage } from "./pages/AdminHomePage";
import { AdminStoresPage } from "./pages/AdminStoresPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { SessionSplashPage } from "./pages/SessionSplashPage";

type Role = "USER" | "PLATFORM_ADMIN" | null;

function AppShell() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("5551234567");
  const [password, setPassword] = useState("ChangeMe123!");
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isHydratingSession, setIsHydratingSession] = useState(true);
  const [stores, setStores] = useState<AssignedStore[]>(() => getAssignedStores());
  const [activeStore, setActiveStoreState] = useState<string | null>(null);
  const [isStoreSelected, setIsStoreSelected] = useState(false);
  const [, setStatus] = useState("Not authenticated");
  const [loading, setLoading] = useState(false);
  const [localProducts, setLocalProducts] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderId>("store");
  const [adminStores, setAdminStores] = useState<AdminStore[]>([]);
  const [adminPage, setAdminPage] = useState(1);
  const [adminPagination, setAdminPagination] = useState<AdminStoresPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [adminFilterStoreName, setAdminFilterStoreName] = useState("");
  const [adminFilterOwnerEmail, setAdminFilterOwnerEmail] = useState("");
  const [adminFilterOwnerPhone, setAdminFilterOwnerPhone] = useState("");
  const adminFilterReadyRef = useRef(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [newStoreName, setNewStoreName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const isAuthenticated = Boolean(identityId);

  const loadProducts = async (tenantId: string) => {
    const items = await getLocalProducts(tenantId);
    setLocalProducts(
      items
        .filter((item) => !item.deletedAt)
        .map((item) => `${String(item.data.sku ?? "")}: ${String(item.data.name ?? "")}`)
    );
  };

  const loadAdminStores = async (
    page = adminPage,
    filters: {
      storeName: string;
      ownerEmail: string;
      ownerPhone: string;
    } = {
      storeName: adminFilterStoreName,
      ownerEmail: adminFilterOwnerEmail,
      ownerPhone: adminFilterOwnerPhone,
    },
  ) => {
    const result = await listAdminStores({
      storeName: filters.storeName,
      ownerEmail: filters.ownerEmail,
      ownerPhone: filters.ownerPhone,
      page,
      limit: 10,
    });
    setAdminStores(result.stores);
    setAdminPage(result.pagination.page);
    setAdminPagination(result.pagination);
  };

  const hydrateSession = async () => {
    try {
      const me = await getMe();
      if (!me.identityId) {
        setIdentityId(null);
        setRole(null);
        setStatus("Not authenticated");
        return false;
      }

      setIdentityId(me.identityId);
      setRole(me.role ?? null);

      if (me.role === "PLATFORM_ADMIN") {
        setStores([]);
        setActiveStoreState(null);
        setIsStoreSelected(false);
        setLocalProducts([]);
        await loadAdminStores(1);
        setStatus("Authenticated");
        return true;
      }

      const localStores = me.stores ?? getAssignedStores();
      setStores(localStores);
      const selected = me.tenantId ?? null;
      setActiveStoreState(selected);
      setIsStoreSelected(Boolean(me.tenantId));
      setStatus("Authenticated");

      if (selected && me.tenantId) {
        setActiveStore(me.tenantId);
        await loadProducts(selected);
      } else {
        setLocalProducts([]);
      }

      return true;
    } catch {
      setIdentityId(null);
      setRole(null);
      setStatus("Session unavailable");
      return false;
    }
  };

  useEffect(() => {
    void hydrateSession().finally(() => {
      setIsHydratingSession(false);
    });
  }, []);

  useEffect(() => {
    if (!activeStore || !isAuthenticated || role !== "USER" || !isStoreSelected) {
      return;
    }

    const interval = window.setInterval(() => {
      void syncOnce(activeStore)
        .then(() => loadProducts(activeStore))
        .catch((error: unknown) => {
          console.error(error);
        });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [activeStore, isAuthenticated, role, isStoreSelected]);

  useEffect(() => {
    if (role !== "PLATFORM_ADMIN") {
      adminFilterReadyRef.current = false;
      return;
    }

    if (!adminFilterReadyRef.current) {
      adminFilterReadyRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setAdminError(null);
      void loadAdminStores(1, {
        storeName: adminFilterStoreName,
        ownerEmail: adminFilterOwnerEmail,
        ownerPhone: adminFilterOwnerPhone,
      })
        .catch((error) => {
          setAdminError(error instanceof Error ? error.message : "Unable to load stores");
        })
        .finally(() => {
          setLoading(false);
        });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [role, adminFilterStoreName, adminFilterOwnerEmail, adminFilterOwnerPhone]);

  const activeStoreName = useMemo(() => {
    return stores.find((store) => store.id === activeStore)?.name ?? "No store selected";
  }, [activeStore, stores]);

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus("Logging in...");

    try {
      await login(username, password);
      clearStoreContext();
      setActiveStoreState(null);
      setIsStoreSelected(false);
      const ok = await hydrateSession();
      if (ok) {
        setStatus("Login successful");
        navigate("/app", { replace: true });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const onApplyStore = async () => {
    if (!activeStore) return;

    setLoading(true);
    setStatus("Selecting store...");
    try {
      await selectStore(activeStore);
      setIsStoreSelected(true);
      setStatus("Store selected");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Store selection failed");
    } finally {
      setLoading(false);
    }
  };

  const onQueueProduct = async () => {
    if (!activeStore || !identityId || !isStoreSelected) {
      setStatus("Select a store and login first");
      return;
    }

    if (!sku || !name) {
      setStatus("SKU and name are required");
      return;
    }

    setLoading(true);
    try {
      await queueProductCreate(activeStore, identityId, {
        sku,
        name,
        description,
        unit: "PCS"
      });
      setStatus("Product mutation queued");
      setSku("");
      setName("");
      setDescription("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to queue mutation");
    } finally {
      setLoading(false);
    }
  };

  const onSyncNow = async () => {
    if (!activeStore || !isStoreSelected) {
      setStatus("Select a store first");
      return;
    }

    setLoading(true);
    setStatus("Sync in progress...");
    try {
      await syncOnce(activeStore);
      await loadProducts(activeStore);
      setStatus("Sync complete");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  };

  const onStoreChange = (storeId: string) => {
    setActiveStore(storeId);
    setActiveStoreState(storeId);
    setIsStoreSelected(false);
  };

  const onCreateStore = async () => {
    if (!newStoreName.trim() || (!newOwnerEmail.trim() && !newOwnerPhone.trim())) {
      setAdminError("Store name and owner email or phone is required.");
      return;
    }

    setLoading(true);
    setAdminError(null);
    try {
      await createAdminStore(newStoreName.trim(), {
        ...(newOwnerEmail.trim() ? { ownerEmail: newOwnerEmail.trim() } : {}),
        ...(newOwnerPhone.trim() ? { ownerPhone: newOwnerPhone.trim() } : {}),
      });
      setNewStoreName("");
      setNewOwnerEmail("");
      setNewOwnerPhone("");
      await loadAdminStores(1);
      navigate("/app/stores", { replace: true });
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Unable to create store");
    } finally {
      setLoading(false);
    }
  };

  const onSaveStoreEdit = async () => {
    if (!editStoreId || !editStoreName.trim() || !editOwnerId.trim()) {
      setAdminError("Store name and owner identity ID are required.");
      return;
    }

    setLoading(true);
    setAdminError(null);
    try {
      await updateAdminStore(editStoreId, {
        name: editStoreName.trim(),
        ownerId: editOwnerId.trim()
      });
      setEditStoreId(null);
      setEditStoreName("");
      setEditOwnerId("");
      await loadAdminStores(adminPage);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Unable to update store");
    } finally {
      setLoading(false);
    }
  };

  const onDeleteStore = async (storeId: string) => {
    setLoading(true);
    setAdminError(null);
    try {
      await deleteAdminStore(storeId);
      if (editStoreId === storeId) {
        setEditStoreId(null);
        setEditStoreName("");
        setEditOwnerId("");
      }
      await loadAdminStores(adminPage);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Unable to delete store");
    } finally {
      setLoading(false);
    }
  };

  const onReloadStores = async () => {
    setLoading(true);
    setAdminError(null);
    try {
      await loadAdminStores(adminPage);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Unable to load stores");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isHydratingSession ? <SessionSplashPage /> : isAuthenticated ? (
            <Navigate to="/app" replace />
          ) : (
            <LoginPage
              username={username}
              password={password}
              loading={loading}
              onUsernameChange={setUsername}
              onPasswordChange={setPassword}
              onSubmit={onLogin}
            />
          )
        }
      />
      <Route path="/test" element={<IosFolder />} />

      <Route
        path="/app"
        element={
          isHydratingSession ? <SessionSplashPage /> : isAuthenticated ? (
            role === "PLATFORM_ADMIN" ? (
              <AdminHomePage />
            ) : (
              <AppHomePage
                stores={stores}
                activeStore={activeStore}
                activeStoreName={activeStoreName}
                loading={loading}
                isAuthenticated={isAuthenticated}
                isStoreSelected={isStoreSelected}
                activeFolder={activeFolder}
                sku={sku}
                name={name}
                description={description}
                localProducts={localProducts}
                onSetActiveFolder={setActiveFolder}
                onStoreChange={onStoreChange}
                onApplyStoreToken={() => void onApplyStore()}
                onSkuChange={setSku}
                onNameChange={setName}
                onDescriptionChange={setDescription}
                onQueueProductCreate={() => void onQueueProduct()}
                onSyncNow={() => void onSyncNow()}
              />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/app/stores"
        element={
          isHydratingSession ? <SessionSplashPage /> : isAuthenticated ? (
            role === "PLATFORM_ADMIN" ? (
              <AdminStoresPage
                mode="list"
                stores={adminStores}
                page={adminPage}
                pagination={adminPagination}
                filterStoreName={adminFilterStoreName}
                filterOwnerEmail={adminFilterOwnerEmail}
                filterOwnerPhone={adminFilterOwnerPhone}
                loading={loading}
                error={adminError}
                newStoreName={newStoreName}
                newOwnerEmail={newOwnerEmail}
                newOwnerPhone={newOwnerPhone}
                editStoreId={editStoreId}
                editStoreName={editStoreName}
                editOwnerId={editOwnerId}
                onFilterStoreNameChange={setAdminFilterStoreName}
                onFilterOwnerEmailChange={setAdminFilterOwnerEmail}
                onFilterOwnerPhoneChange={setAdminFilterOwnerPhone}
                onApplyFilters={() =>
                  void loadAdminStores(1, {
                    storeName: adminFilterStoreName,
                    ownerEmail: adminFilterOwnerEmail,
                    ownerPhone: adminFilterOwnerPhone,
                  })
                }
                onClearFilters={() => {
                  const cleared = { storeName: "", ownerEmail: "", ownerPhone: "" };
                  setAdminFilterStoreName("");
                  setAdminFilterOwnerEmail("");
                  setAdminFilterOwnerPhone("");
                  void loadAdminStores(1, cleared);
                }}
                onPrevPage={() => void loadAdminStores(Math.max(1, adminPage - 1))}
                onNextPage={() => void loadAdminStores(adminPage + 1)}
                onNewStoreNameChange={setNewStoreName}
                onNewOwnerEmailChange={setNewOwnerEmail}
                onNewOwnerPhoneChange={setNewOwnerPhone}
                onCreate={() => void onCreateStore()}
                onStartEdit={(store) => {
                  setEditStoreId(store.id);
                  setEditStoreName(store.name);
                  setEditOwnerId(store.ownerId);
                }}
                onCancelEdit={() => {
                  setEditStoreId(null);
                  setEditStoreName("");
                  setEditOwnerId("");
                }}
                onEditStoreNameChange={setEditStoreName}
                onEditOwnerIdChange={setEditOwnerId}
                onSaveEdit={() => void onSaveStoreEdit()}
                onDelete={(storeId) => void onDeleteStore(storeId)}
                onReload={() => void onReloadStores()}
              />
            ) : (
              <Navigate to="/app" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/app/stores/new"
        element={
          isHydratingSession ? <SessionSplashPage /> : isAuthenticated ? (
            role === "PLATFORM_ADMIN" ? (
              <AdminStoresPage
                mode="new"
                stores={adminStores}
                page={adminPage}
                pagination={adminPagination}
                filterStoreName={adminFilterStoreName}
                filterOwnerEmail={adminFilterOwnerEmail}
                filterOwnerPhone={adminFilterOwnerPhone}
                loading={loading}
                error={adminError}
                newStoreName={newStoreName}
                newOwnerEmail={newOwnerEmail}
                newOwnerPhone={newOwnerPhone}
                editStoreId={editStoreId}
                editStoreName={editStoreName}
                editOwnerId={editOwnerId}
                onFilterStoreNameChange={setAdminFilterStoreName}
                onFilterOwnerEmailChange={setAdminFilterOwnerEmail}
                onFilterOwnerPhoneChange={setAdminFilterOwnerPhone}
                onApplyFilters={() =>
                  void loadAdminStores(1, {
                    storeName: adminFilterStoreName,
                    ownerEmail: adminFilterOwnerEmail,
                    ownerPhone: adminFilterOwnerPhone,
                  })
                }
                onClearFilters={() => {
                  const cleared = { storeName: "", ownerEmail: "", ownerPhone: "" };
                  setAdminFilterStoreName("");
                  setAdminFilterOwnerEmail("");
                  setAdminFilterOwnerPhone("");
                  void loadAdminStores(1, cleared);
                }}
                onPrevPage={() => void loadAdminStores(Math.max(1, adminPage - 1))}
                onNextPage={() => void loadAdminStores(adminPage + 1)}
                onNewStoreNameChange={setNewStoreName}
                onNewOwnerEmailChange={setNewOwnerEmail}
                onNewOwnerPhoneChange={setNewOwnerPhone}
                onCreate={() => void onCreateStore()}
                onStartEdit={(store) => {
                  setEditStoreId(store.id);
                  setEditStoreName(store.name);
                  setEditOwnerId(store.ownerId);
                }}
                onCancelEdit={() => {
                  setEditStoreId(null);
                  setEditStoreName("");
                  setEditOwnerId("");
                }}
                onEditStoreNameChange={setEditStoreName}
                onEditOwnerIdChange={setEditOwnerId}
                onSaveEdit={() => void onSaveStoreEdit()}
                onDelete={(storeId) => void onDeleteStore(storeId)}
                onReload={() => void onReloadStores()}
              />
            ) : (
              <Navigate to="/app" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/app/users"
        element={
          isHydratingSession ? <SessionSplashPage /> : isAuthenticated ? (
            role === "PLATFORM_ADMIN" ? (
              <AdminUsersPage />
            ) : (
              <Navigate to="/app" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/"
        element={
          isHydratingSession ? (
            <SessionSplashPage />
          ) : (
            <Navigate to={isAuthenticated ? "/app" : "/login"} replace />
          )
        }
      />
      <Route
        path="*"
        element={
          isHydratingSession ? (
            <SessionSplashPage />
          ) : (
            <Navigate to={isAuthenticated ? "/app" : "/login"} replace />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
