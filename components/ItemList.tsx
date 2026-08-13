export interface ItemLine {
  name: string;
  qty: string;
  price: string;
}

// Numbered shopping list used on the runner side so the runner can see
// exactly what to buy/pick up in order, with qty + price per line.
export default function ItemList({
  items,
  title = "What to buy / pick up",
}: {
  items: ItemLine[];
  title?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-[10px] bg-[#F0F7F4] border border-[#D7EBE1] px-3 py-2.5 mt-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-teal mb-2">
        🛒 {title}
      </div>
      <ol className="space-y-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-center gap-2.5 min-w-0"
          >
            <span className="w-5 h-5 rounded-full bg-teal text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {i + 1}
            </span>
            <span className="text-[12.5px] font-medium text-ink break-words flex-1 min-w-0">
              {it.name}
            </span>
            <span className="flex items-center gap-1.5 flex-shrink-0">
              {it.qty && (
                <span className="font-mono text-[11px] font-bold text-teal bg-white border border-[#BFDDD0] rounded-md px-1.5 py-0.5 whitespace-nowrap">
                  ×{it.qty}
                </span>
              )}
              {it.price && (
                <span className="font-mono text-[11px] text-slate whitespace-nowrap">
                  {it.price}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
