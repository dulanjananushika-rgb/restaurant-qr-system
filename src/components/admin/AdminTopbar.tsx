"use client";

import {
  BarChart3,
  Bell,
  ChefHat,
  CookingPot,
  FileClock,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  QrCode,
  ReceiptText,
  Search,
  Truck,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const searchPages = [
  {
    name: "Dashboard",
    description: "Overview, revenue and recent orders",
    href: "/admin/dashboard",
    keywords: ["dashboard", "home", "overview", "revenue"],
    icon: LayoutDashboard,
  },
  {
    name: "Menu Items",
    description: "Add, edit and manage food items",
    href: "/admin/menu",
    keywords: ["menu", "food", "items", "price"],
    icon: Utensils,
  },
  {
    name: "Categories",
    description: "Manage food categories",
    href: "/admin/categories",
    keywords: ["category", "categories"],
    icon: FolderOpen,
  },
  {
    name: "Tables & QR",
    description: "Manage tables and QR codes",
    href: "/admin/tables",
    keywords: ["table", "tables", "qr", "qrcode"],
    icon: QrCode,
  },
  {
    name: "Kitchen",
    description: "Kitchen order preparation workspace",
    href: "/kitchen/orders",
    keywords: ["kitchen", "chef", "prepare", "preparing"],
    icon: ChefHat,
  },
  {
    name: "Waiter",
    description: "Ready orders and table delivery",
    href: "/waiter/orders",
    keywords: ["waiter", "delivery", "delivered", "pickup"],
    icon: Truck,
  },
  {
    name: "Cashier",
    description: "Pay later bills and payments",
    href: "/cashier/orders",
    keywords: ["cashier", "payment", "paid", "bill"],
    icon: ReceiptText,
  },
  {
    name: "Inventory",
    description: "Stock items and low stock alerts",
    href: "/admin/inventory",
    keywords: ["inventory", "stock", "ingredient", "ingredients"],
    icon: Package,
  },
  {
    name: "Recipes",
    description: "Recipe mapping and ingredient usage",
    href: "/admin/recipes",
    keywords: ["recipe", "recipes", "mapping", "ingredient"],
    icon: CookingPot,
  },
  {
    name: "Staff",
    description: "Staff accounts, roles and status",
    href: "/admin/staff",
    keywords: ["staff", "user", "users", "role"],
    icon: Users,
  },
  {
    name: "Reports",
    description: "Sales, orders and stock reports",
    href: "/admin/reports",
    keywords: ["report", "reports", "analytics", "sales"],
    icon: BarChart3,
  },
  {
    name: "Audit Logs",
    description: "System activity history",
    href: "/admin/audit-logs",
    keywords: ["audit", "logs", "activity", "history"],
    icon: FileClock,
  },
];

export default function AdminTopbar() {
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const suggestions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return searchPages.slice(0, 5);
    }

    return searchPages
      .filter((page) => {
        const nameMatch = page.name.toLowerCase().includes(keyword);
        const descriptionMatch = page.description
          .toLowerCase()
          .includes(keyword);
        const keywordMatch = page.keywords.some((item) =>
          item.includes(keyword)
        );

        return nameMatch || descriptionMatch || keywordMatch;
      })
      .slice(0, 6);
  }, [search]);

  function goToPage(href: string) {
    setSearch("");
    setSearchFocused(false);
    router.push(href);
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (suggestions.length > 0) {
      goToPage(suggestions[0].href);
      return;
    }

    alert("No matching page found.");
  }

  async function handleLogout() {
    if (loggingOut) return;

    const confirmLogout = confirm("Are you sure you want to logout?");

    if (!confirmLogout) return;

    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.message || "Logout failed");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      alert("Something went wrong while logging out.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0F14]/90 px-5 py-4 backdrop-blur-xl lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-neutral-500">Admin Panel</p>
          <h2 className="truncate text-lg font-semibold tracking-tight md:text-xl">
            Restaurant Command Center
          </h2>
        </div>

        <form
          onSubmit={handleSearch}
          className="relative hidden w-full max-w-md md:block"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <Search size={18} className="text-neutral-500" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search menu, tables, reports..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-neutral-500 transition hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {searchFocused && (
            <div className="absolute left-0 right-0 top-[58px] z-50 overflow-hidden rounded-3xl border border-white/10 bg-[#11161F] p-2 shadow-2xl shadow-black/40">
              {suggestions.length > 0 ? (
                <div className="space-y-1">
                  {suggestions.map((page) => {
                    const Icon = page.icon;

                    return (
                      <button
                        key={page.href}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          goToPage(page.href);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/10"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                          <Icon size={18} />
                        </div>

                        <div>
                          <p className="text-sm font-medium text-white">
                            {page.name}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {page.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl px-4 py-5 text-center">
                  <p className="text-sm font-medium text-neutral-300">
                    No results found
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Try searching menu, tables, inventory or reports.
                  </p>
                </div>
              )}
            </div>
          )}
        </form>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/audit-logs")}
            className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-neutral-300 transition hover:bg-white/10"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400" />
          </button>

          <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 sm:flex">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-lime-300" />

            <div className="hidden md:block">
              <p className="text-sm font-medium">Admin</p>
              <p className="text-xs text-neutral-500">Owner Access</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogOut size={16} />
            )}

            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </header>
  );
}