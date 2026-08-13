export default function PhoneFrame({
  children,
  narrow = false,
  wide = false,
  className = "",
}: {
  children: React.ReactNode;
  narrow?: boolean;
  wide?: boolean;
  className?: string;
}) {
  // `narrow` keeps forms at a comfortable reading width even on desktop.
  // `wide` lets a page use the full container width.
  // Default: phone-width card on mobile, full width on desktop.
  const hasWidth = className.includes("max-w-");
  const widthClass = wide
    ? "w-full"
    : narrow
    ? "max-w-[420px] md:max-w-xl mx-auto"
    : hasWidth
    ? "w-full"
    : "max-w-[420px] md:max-w-none mx-auto";
  return (
    <div
      className={`bg-paper border border-line rounded-[18px] md:rounded-[24px] p-5 md:p-8 shadow-[0_20px_50px_-20px_rgba(28,35,33,0.25)] ${widthClass} ${className}`}
    >
      {children}
    </div>
  );
}
