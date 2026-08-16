// Tiny inline renderer for **bold** and *italic* inside i18n strings.
// Shared by the About page and the Join Guide modal so JomCOD stays bold.
export default function Md({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return (
            <b key={i} className="text-ink">
              {p.slice(2, -2)}
            </b>
          );
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
          return (
            <em key={i} className="text-ink">
              {p.slice(1, -1)}
            </em>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
