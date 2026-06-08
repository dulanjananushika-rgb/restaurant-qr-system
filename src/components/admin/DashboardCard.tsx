import { LucideIcon } from "lucide-react";

type DashboardCardProps = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
};

export default function DashboardCard({
  title,
  value,
  description,
  icon: Icon,
}: DashboardCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 transition hover:border-emerald-400/30 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">{title}</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight">
            {value}
          </h3>
        </div>

        <div className="rounded-2xl bg-white/5 p-3 text-emerald-300">
          <Icon size={22} />
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-neutral-400">{description}</p>
    </div>
  );
}