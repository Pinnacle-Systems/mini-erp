import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../design-system/atoms/Button";
import { Input } from "../design-system/atoms/Input";
import { Label } from "../design-system/atoms/Label";
import { Select } from "../design-system/atoms/Select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../design-system/molecules/Card";
import { useSessionStore } from "../features/auth/session-store";
import { queueItemCreate, syncOnce } from "../features/sync/engine";

const UNIT_OPTIONS = ["PCS", "KG", "M", "BOX"] as const;
const ITEM_TYPE_OPTIONS = ["PRODUCT", "SERVICE"] as const;

export function AddItemPage() {
  const navigate = useNavigate();
  const identityId = useSessionStore((state) => state.identityId);
  const activeStore = useSessionStore((state) => state.activeStore);
  const isStoreSelected = useSessionStore((state) => state.isStoreSelected);
  const [itemType, setItemType] =
    useState<(typeof ITEM_TYPE_OPTIONS)[number]>("PRODUCT");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState<(typeof UNIT_OPTIONS)[number]>("PCS");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!identityId || !activeStore || !isStoreSelected || !name.trim()) return;

    setLoading(true);
    try {
      await queueItemCreate(activeStore, identityId, {
        itemType,
        sku: sku.trim(),
        name: name.trim(),
        description: description.trim(),
        unit,
      });
      await syncOnce(activeStore).catch(() => null);
      navigate("/app/items");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full p-4 sm:p-6 md:p-10">
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Add Item</CardTitle>
          <CardDescription>Create a new item for the active store.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="itemType">Item type</Label>
              <Select
                id="itemType"
                value={itemType}
                onChange={(event) =>
                  setItemType(event.target.value as (typeof ITEM_TYPE_OPTIONS)[number])
                }
              >
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                placeholder="Optional for services"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit">Unit</Label>
              <Select
                id="unit"
                value={unit}
                onChange={(event) =>
                  setUnit(event.target.value as (typeof UNIT_OPTIONS)[number])
                }
              >
                {UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-2 flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Item"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/app/items")}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
