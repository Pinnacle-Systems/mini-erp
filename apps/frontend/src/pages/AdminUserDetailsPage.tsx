import { Pencil, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import {
  Card,
  CardContent,
} from "../design-system/molecules/Card";
import { getAdminUser, updateAdminUser, type AdminUserDetails } from "../features/admin/users";

export function AdminUserDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<AdminUserDetails | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError("User not found");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void getAdminUser(userId)
      .then((result) => {
        setUser(result);
        setDraft({
          name: result.name ?? "",
          email: result.email ?? "",
          phone: result.phone ?? "",
        });
        setIsEditing(false);
      })
      .catch((requestError) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load user",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  const onSave = async () => {
    if (!userId || !user) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAdminUser(userId, {
        name: draft.name.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
      });
      setUser(updated);
      setDraft({
        name: updated.name ?? "",
        email: updated.email ?? "",
        phone: updated.phone ?? "",
      });
      setIsEditing(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update user",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="h-auto lg:h-full lg:min-h-0">
      <Card className="h-auto p-2 lg:h-full lg:min-h-0">
        <CardContent className="space-y-2 lg:h-full lg:min-h-0 lg:overflow-y-auto">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {!user && !loading ? (
            <p className="text-sm text-muted-foreground">User not found.</p>
          ) : user ? (
            <>
              <div className="flex justify-end">
                {!isEditing ? (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    disabled={saving}
                    className="h-7 gap-1 px-2 text-[11px]"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit Details
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      onClick={() => void onSave()}
                      disabled={saving}
                      className="h-7 gap-1 px-2 text-[11px]"
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Save Details
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDraft({
                          name: user.name ?? "",
                          email: user.email ?? "",
                          phone: user.phone ?? "",
                        });
                        setIsEditing(false);
                      }}
                      disabled={saving}
                      className="h-7 px-2 text-[11px]"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              <fieldset className="space-y-2 rounded-lg border border-[#d7e2ef] bg-white p-2">
                <legend className="m-0 rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
                  User Profile
                </legend>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Name</p>
                    {isEditing ? (
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        disabled={saving}
                        className="h-8 w-full rounded-md border border-[#c6d5e6] px-2 text-xs"
                      />
                    ) : (
                      <p className="text-xs">{user.name?.trim() || "Unnamed user"}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Phone</p>
                    {isEditing ? (
                      <input
                        value={draft.phone}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                          }))
                        }
                        disabled={saving}
                        className="h-8 w-full rounded-md border border-[#c6d5e6] px-2 text-xs"
                      />
                    ) : (
                      <p className="text-xs">{user.phone || "-"}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Email</p>
                    {isEditing ? (
                      <input
                        value={draft.email}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        disabled={saving}
                        className="h-8 w-full rounded-md border border-[#c6d5e6] px-2 text-xs"
                      />
                    ) : (
                      <p className="text-xs">{user.email || "-"}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">System role</p>
                    <p className="text-xs">{user.deletedAt ? "Deleted" : user.systemRole}</p>
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-2 rounded-lg border border-[#d7e2ef] bg-white p-2">
                <legend className="m-0 rounded-full border border-[#d7e2ef] bg-[#f2f7fd] px-2 py-0.5 text-xs font-semibold tracking-[0.01em] text-[#1f4167]">
                  Business Memberships
                </legend>
                {user.memberships.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No business memberships.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {user.memberships.map((membership) => (
                      <div
                        key={`${membership.businessId}-${membership.role}`}
                        className="rounded-md border border-[#e5edf7] bg-[#fbfdff] px-2 py-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to={`/app/businesses/${membership.businessId}`}
                            className="truncate text-xs font-medium text-[#24507e] underline-offset-2 hover:underline"
                          >
                            {membership.businessName}
                          </Link>
                          <span className="rounded-full bg-[#e8f2ff] px-2 py-0.5 text-[10px] font-medium text-[#24507e]">
                            {membership.role}
                          </span>
                        </div>
                        {membership.businessDeletedAt ? (
                          <p className="mt-1 text-[10px] text-[#8a2b2b]">Deleted business</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            </>
          ) : (
            <div className="min-h-32" aria-hidden="true" />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
