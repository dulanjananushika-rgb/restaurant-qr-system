import { connectDB } from "@/lib/mongodb";

import User from "@/models/User";
import StaffManager from "@/components/admin/StaffManager";

async function getStaff() {
  await connectDB();

  const staff = await User.find()
    .select("-password")
    .sort({ createdAt: -1 })
    .lean();

  return staff.map((member) => ({
    _id: member._id.toString(),
    name: member.name,
    email: member.email,
    role: member.role,
    status: member.status,
    createdAt: member.createdAt?.toISOString(),
  }));
}

export default async function AdminStaffPage() {
  const staff = await getStaff();

  const activeStaff = staff.filter((member) => member.status === "ACTIVE");
  const inactiveStaff = staff.filter((member) => member.status === "INACTIVE");

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm font-medium text-emerald-300">
          Staff Management
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Manage restaurant staff accounts
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          Create and manage staff access for admins, kitchen staff, waiters and
          cashiers.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Total Staff</p>
          <h3 className="mt-2 text-3xl font-semibold">{staff.length}</h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Active</p>
          <h3 className="mt-2 text-3xl font-semibold text-emerald-300">
            {activeStaff.length}
          </h3>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-neutral-500">Inactive</p>
          <h3 className="mt-2 text-3xl font-semibold text-red-300">
            {inactiveStaff.length}
          </h3>
        </div>
      </section>

      <StaffManager staff={staff} />
    </div>
  );
}