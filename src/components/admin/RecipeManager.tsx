"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CookingPot,
  Loader2,
  Plus,
  Save,
  Trash2,
  Utensils,
} from "lucide-react";

type MenuItem = {
  _id: string;
  name: string;
  price: number;
};

type InventoryItem = {
  _id: string;
  name: string;
  unit: string;
  quantity: number;
};

type RecipeItem = {
  _id: string;
  menuItem?: MenuItem;
  inventoryItem?: InventoryItem;
  requiredQuantity: number;
};

type IngredientRow = {
  rowId: string;
  inventoryItem: string;
  requiredQuantity: string;
};

function createRow(inventoryItem = ""): IngredientRow {
  return {
    rowId: crypto.randomUUID(),
    inventoryItem,
    requiredQuantity: "",
  };
}

export default function RecipeManager({
  recipes,
  menuItems,
  inventoryItems,
}: {
  recipes: RecipeItem[];
  menuItems: MenuItem[];
  inventoryItems: InventoryItem[];
}) {
  const router = useRouter();

  const [selectedMenuItem, setSelectedMenuItem] = useState(
    menuItems[0]?._id || ""
  );

  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([
    createRow(inventoryItems[0]?._id || ""),
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const groupedRecipes = useMemo(() => {
    const map = new Map<
      string,
      {
        menuItem?: MenuItem;
        ingredients: RecipeItem[];
      }
    >();

    for (const recipe of recipes) {
      const menuId = recipe.menuItem?._id;

      if (!menuId) continue;

      if (!map.has(menuId)) {
        map.set(menuId, {
          menuItem: recipe.menuItem,
          ingredients: [],
        });
      }

      map.get(menuId)?.ingredients.push(recipe);
    }

    return Array.from(map.values());
  }, [recipes]);

  function addIngredientRow() {
    setIngredientRows((current) => [
      ...current,
      createRow(inventoryItems[0]?._id || ""),
    ]);
  }

  function removeIngredientRow(rowId: string) {
    setIngredientRows((current) =>
      current.length === 1
        ? current
        : current.filter((row) => row.rowId !== rowId)
    );
  }

  function updateRow(
    rowId: string,
    field: "inventoryItem" | "requiredQuantity",
    value: string
  ) {
    setIngredientRows((current) =>
      current.map((row) =>
        row.rowId === rowId ? { ...row, [field]: value } : row
      )
    );
  }

  function loadExistingRecipe(menuItemId: string) {
    setSelectedMenuItem(menuItemId);
    setError("");

    const existingRecipes = recipes.filter(
      (recipe) => recipe.menuItem?._id === menuItemId
    );

    if (existingRecipes.length === 0) {
      setIngredientRows([createRow(inventoryItems[0]?._id || "")]);
      return;
    }

    setIngredientRows(
      existingRecipes.map((recipe) => ({
        rowId: crypto.randomUUID(),
        inventoryItem: recipe.inventoryItem?._id || "",
        requiredQuantity: recipe.requiredQuantity.toString(),
      }))
    );
  }

  async function handleSaveRecipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    if (!selectedMenuItem) {
      setError("Please select a menu item");
      setLoading(false);
      return;
    }

    const ingredients = ingredientRows
      .filter((row) => row.inventoryItem && Number(row.requiredQuantity) > 0)
      .map((row) => ({
        inventoryItem: row.inventoryItem,
        requiredQuantity: Number(row.requiredQuantity),
      }));

    if (ingredients.length === 0) {
      setError("Please add at least one valid ingredient");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          menuItem: selectedMenuItem,
          ingredients,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to save recipe");
        return;
      }

      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <p className="text-sm font-medium text-emerald-300">
            Recipe Builder
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Build full recipe for a menu item
          </h2>

          <p className="mt-1 text-sm leading-6 text-neutral-500">
            First add ingredients in Inventory & Ingredients. Then select a menu
            item and add all required ingredients here.
          </p>
        </div>

        <form onSubmit={handleSaveRecipe} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Select menu item
            </span>

            <select
              value={selectedMenuItem}
              onChange={(event) => loadExistingRecipe(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
            >
              {menuItems.map((item) => (
                <option key={item._id} value={item._id} className="bg-[#0B0F14]">
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Ingredients</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Quantity is required for one menu item.
                </p>
              </div>

              <button
                type="button"
                onClick={addIngredientRow}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200"
              >
                <Plus size={15} />
                Add
              </button>
            </div>

            <div className="space-y-3">
              {ingredientRows.map((row, index) => {
                const selectedInventory = inventoryItems.find(
                  (item) => item._id === row.inventoryItem
                );

                return (
                  <div
                    key={row.rowId}
                    className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1.2fr_0.7fr_auto]"
                  >
                    <label className="block">
                      <span className="mb-2 block text-xs text-neutral-500">
                        Ingredient {index + 1}
                      </span>

                      <select
                        value={row.inventoryItem}
                        onChange={(event) =>
                          updateRow(
                            row.rowId,
                            "inventoryItem",
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none focus:border-emerald-400/50"
                      >
                        {inventoryItems.map((item) => (
                          <option
                            key={item._id}
                            value={item._id}
                            className="bg-[#0B0F14]"
                          >
                            {item.name} ({item.unit})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs text-neutral-500">
                        Required qty{" "}
                        {selectedInventory ? `(${selectedInventory.unit})` : ""}
                      </span>

                      <input
                        value={row.requiredQuantity}
                        onChange={(event) =>
                          updateRow(
                            row.rowId,
                            "requiredQuantity",
                            event.target.value
                          )
                        }
                        placeholder="250"
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
                      />
                    </label>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeIngredientRow(row.rowId)}
                        disabled={ingredientRows.length === 1}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || menuItems.length === 0 || inventoryItems.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}
            {loading ? "Saving recipe..." : "Save full recipe"}
          </button>
        </form>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Saved Recipes</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Recipes grouped by menu item.
          </p>
        </div>

        <div className="space-y-4">
          {groupedRecipes.map((group) => (
            <div
              key={group.menuItem?._id}
              className="rounded-[24px] border border-white/10 bg-black/20 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                    <CookingPot size={20} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      {group.menuItem?.name || "Menu item"}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {group.ingredients.length} ingredients
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => loadExistingRecipe(group.menuItem?._id || "")}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-300 hover:bg-white/10"
                >
                  Edit
                </button>
              </div>

              <div className="space-y-2">
                {group.ingredients.map((recipe) => (
                  <div
                    key={recipe._id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {recipe.inventoryItem?.name || "Ingredient"}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        Available: {recipe.inventoryItem?.quantity}{" "}
                        {recipe.inventoryItem?.unit}
                      </p>
                    </div>

                    <p className="text-sm font-semibold text-emerald-300">
                      {recipe.requiredQuantity} {recipe.inventoryItem?.unit}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {groupedRecipes.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
              <Utensils className="mx-auto mb-3 text-neutral-600" size={36} />
              <p className="text-sm text-neutral-500">
                No recipes saved yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}