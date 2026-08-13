export default function RoleBadge({ role }: { role?: string }) {
  if (!role) return null;
  const isRunner = role === "runner";
  return (
    <span
      className={`font-mono text-[10px] font-semibold rounded-full px-2 py-1 flex items-center gap-1 border whitespace-nowrap ${
        isRunner
          ? "bg-[#FDF6E3] text-[#8A6D00] border-[#F0E0A8]"
          : "bg-[#E4F3EC] text-teal border-[#C8E6DA]"
      }`}
    >
      {isRunner ? "🛵 Runner" : "🏠 Community"}
    </span>
  );
}
