import { PROGRAM_STATUS_LABELS, PROGRAM_STATUS_COLORS } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = PROGRAM_STATUS_LABELS[status] || status;
  const color = PROGRAM_STATUS_COLORS[status] || "bg-gray-100 text-gray-800";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
