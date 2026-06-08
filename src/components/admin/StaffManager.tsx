"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";

type StaffRole = "ADMIN" | "KITCHEN_STAFF" | "WAITER" | "CASHIER";
type StaffStatus = "ACTIVE" | "INACTIVE";

type StaffMember = {
  _id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  createdAt?: string;
};

const roles: StaffRole[] = ["ADMIN", "KITCHEN_STAFF", "WAITER", "CASHIER"];
const statuses: StaffStatus[] = ["ACTIVE", "INACTIVE"];

function roleLabel(role: StaffRole) {
  if (role === "KITCHEN_STAFF") return "Kitchen Staff";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function roleIcon(role: StaffRole) {
  if (role === "ADMIN") return ShieldCheck;
  if (role === "KITCHEN_STAFF") return ChefHat;
  if (role === "CASHIER") return CreditCard;
  return UserRound;
}

function roleBadgeStyle(role: StaffRole) {
  if (role === "ADMIN") {
    return "border-purple-500/20 bg-purple-500/10 text-purple-300";
  }

  if (role === "KITCHEN_STAFF") {
    return "border-orange-500/20 bg-orange-500/10 text-orange-300";
  }

  if (role === "CASHIER") {
    return "border-sky-500/20 bg-sky-500/10 text-sky-300";
  }

  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
}

export default function StaffManager({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();

  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("WAITER");
  const [status, setStatus] = useState<StaffStatus>("ACTIVE");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(editingStaff);

  function resetForm() {
    setEditingStaff(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("WAITER");
    setStatus("ACTIVE");
    setError("");
  }

  function startEdit(member: StaffMember) {
    setEditingStaff(member);
    setName(member.name);
    setEmail(member.email);
    setPassword("");
    setRole(member.role);
    setStatus(member.status);
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEditing
        ? `/api/admin/staff/${editingStaff?._id}`
        : "/api/admin/staff";

      const method = isEditing ? "PATCH" : "POST";

      const body = isEditing
        ? {
            name,
            email,
            password,
            role,
            status,
          }
        : {
            name,
            email,
            password,
            role,
            status,
          };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.message || "Failed to save staff member");
        return;
      }

      resetForm();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.5fr]">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <p className="text-sm font-medium text-emerald-300">
            {isEditing ? "Edit Staff Account" : "Add Staff Account"}
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            {isEditing ? "Update restaurant staff" : "Create restaurant staff"}
          </h2>

          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Create accounts for admin, kitchen staff, waiters and cashiers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Staff name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nimal Perera"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              Email address
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@restaurant.com"
              type="email"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">
              {isEditing ? "New password optional" : "Password"}
            </span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isEditing ? "Leave empty to keep current password" : "staff123"}
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
            >
              {roles.map((item) => (
                <option key={item} value={item} className="bg-[#0B0F14]">
                  {roleLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-neutral-400">Status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as StaffStatus)
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-emerald-400/50"
            >
              {statuses.map((item) => (
                <option key={item} value={item} className="bg-[#0B0F14]">
                  {item}
                </option>
              ))}
            </select>
          </label>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/10"
              >
                <X size={17} />
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : isEditing ? (
                <Save size={17} />
              ) : (
                <Plus size={17} />
              )}
              {loading
                ? "Saving..."
                : isEditing
                ? "Update Staff"
                : "Add Staff"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Staff Accounts</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Manage restaurant team access and role permissions.
          </p>
        </div>

        <div className="space-y-3">
          {staff.map((member) => {
            const Icon = roleIcon(member.role);

            return (
              <div
                key={member._id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-neutral-200">
                      <Icon size={20} />
                    </div>

                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {member.email}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${roleBadgeStyle(
                            member.role
                          )}`}
                        >
                          {roleLabel(member.role)}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            member.status === "ACTIVE"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : "border-red-500/20 bg-red-500/10 text-red-300"
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => startEdit(member)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-300 transition hover:bg-white/10"
                  >
                    <Pencil size={15} />
                    Edit
                  </button>
                </div>
              </div>
            );
          })}

          {staff.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
              <Users className="mx-auto mb-3 text-neutral-600" size={36} />
              <p className="text-sm text-neutral-500">
                No staff accounts found.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}