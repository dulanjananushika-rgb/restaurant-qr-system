import { connectDB } from "@/lib/mongodb";

import RecipeItem from "@/models/RecipeItem";
import MenuItem from "@/models/MenuItem";
import InventoryItem from "@/models/InventoryItem";
import "@/models/Category";

import RecipeManager from "@/components/admin/RecipeManager";

async function getRecipeData() {
  await connectDB();

  const [recipes, menuItems, inventoryItems] = await Promise.all([
    RecipeItem.find()
      .sort({ createdAt: -1 })
      .populate("menuItem")
      .populate("inventoryItem")
      .lean(),
    MenuItem.find().sort({ name: 1 }).lean(),
    InventoryItem.find().sort({ name: 1 }).lean(),
  ]);

  return {
    recipes: JSON.parse(JSON.stringify(recipes)),
    menuItems: JSON.parse(JSON.stringify(menuItems)),
    inventoryItems: JSON.parse(JSON.stringify(inventoryItems)),
  };
}

export default async function AdminRecipesPage() {
  const { recipes, menuItems, inventoryItems } = await getRecipeData();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm font-medium text-emerald-300">
          Recipe Mapping
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Connect menu items with ingredients
        </h1>

       <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
  Build complete ingredient recipes for each menu item. Ingredients are loaded
  from Inventory & Ingredients and used for automatic stock deduction when
  customers place orders.
</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Recipe Mappings</p>
          <h3 className="mt-2 text-3xl font-semibold">{recipes.length}</h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Menu Items</p>
          <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
            {menuItems.length}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Inventory Items</p>
          <h3 className="mt-2 text-3xl font-semibold text-amber-300">
            {inventoryItems.length}
          </h3>
        </div>
      </section>

      <RecipeManager
        recipes={recipes}
        menuItems={menuItems}
        inventoryItems={inventoryItems}
      />
    </div>
  );
}