import { connectDB } from "@/lib/mongodb";
import Category from "@/models/Category";
import CategoryManager from "@/components/admin/CategoryManager";

async function getCategories() {
  await connectDB();

  const categories = await Category.find().sort({ createdAt: -1 }).lean();

  return categories.map((category) => ({
    _id: category._id.toString(),
    name: category.name,
    description: category.description || "",
    createdAt: category.createdAt?.toISOString(),
  }));
}

export default async function AdminCategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm font-medium text-emerald-300">
          Category Management
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Organize your restaurant menu
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Create, update and delete categories such as rice, kottu, drinks,
          desserts and specials. Categories help customers browse the menu
          easily from the QR ordering screen.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Total Categories</p>
          <h3 className="mt-2 text-3xl font-semibold">{categories.length}</h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Ordering Screen</p>
          <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
            Menu
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Use Case</p>
          <h3 className="mt-2 text-3xl font-semibold text-amber-300">QR</h3>
        </div>
      </section>

      <CategoryManager categories={categories} />
    </div>
  );
}