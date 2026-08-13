import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "whatsapp";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-orange text-white",
  secondary: "bg-ink text-paper",
  outline: "bg-transparent text-ink border border-line",
  whatsapp: "bg-[#25D366] text-white",
};

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-[10px] px-4 py-3 text-[13.5px] font-semibold cursor-pointer text-center inline-flex items-center justify-center gap-2 w-full transition-opacity hover:opacity-90 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
