"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChefHat,
  ShoppingCart,
  CookingPot,
  Gift,
  ClipboardList,
  FileClock,
  FolderOpen,
  LayoutDashboard,
  Package,
  QrCode,
  UserRoundCheck,
  ReceiptText,
  Settings,
  Store,
  Truck,
  Users,
  Utensils,
} from "lucide-react";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
  { name: "Orders", icon: ClipboardList, href: "/admin/orders" },
  { name: "Menu Items", icon: Utensils, href: "/admin/menu" },
  { name: "Combo Offers", icon: Gift, href: "/admin/combo-offers" },
  { name: "Categories", icon: FolderOpen, href: "/admin/categories" },
  { name: "Tables & QR", icon: QrCode, href: "/admin/tables" },
  {
  name: "Takeaway QR",
  icon: QrCode,
  href: "/admin/takeaway-qr",
},

  {
  name: "Waiter Assignments",
  icon: UserRoundCheck,
  href: "/admin/table-assignments",
   },
  { name: "Kitchen", icon: ChefHat, href: "/kitchen/orders" },
  { name: "Waiter", icon: Truck, href: "/waiter/orders" },
  { name: "Cashier", icon: ReceiptText, href: "/cashier/orders" },

  { name: "Inventory", icon: Package, href: "/admin/inventory" },
  { name: "Purchases", icon: ShoppingCart, href: "/admin/purchases" },
  { name: "Recipes", icon: CookingPot, href: "/admin/recipes" },
  { name: "Staff", icon: Users, href: "/admin/staff" },

  { name: "Reports", icon: BarChart3, href: "/admin/reports" },
  { name: "Audit Logs", icon: FileClock, href: "/admin/audit-logs" },
  { name: "Settings", icon: Settings, href: "/admin/settings" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-white/10 bg-[#080B10] px-4 py-5 lg:block">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <Store size={24} />
        </div>

        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Saffron Table
          </h1>
          <p className="text-xs text-neutral-500">Restaurant OS</p>
        </div>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <p className="text-sm font-medium text-emerald-300">
          Today&apos;s Service
        </p>
        <p className="mt-2 text-xs leading-5 text-neutral-400">
          QR dine-in, kitchen flow, waiter delivery and cashier payments are
          running.
        </p>
      </div>
    </aside>
  );
}