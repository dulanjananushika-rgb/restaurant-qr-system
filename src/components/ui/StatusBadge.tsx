type StatusBadgeProps = {
  status: "Pending" | "Preparing" | "Ready" | "Delivered" | "Paid";
};

const styles = {
  Pending: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  Preparing: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  Ready: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  Delivered: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  Paid: "bg-lime-500/10 text-lime-300 border-lime-500/20",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}