export default function HeroBand() {
  const items = [
    "PRD",
    "Spesifikasi",
    "Rencana",
    "Tasks",
    "Multi-Model",
    "Streaming",
    "Gateway Sendiri",
    "Tanpa Akun",
  ];

  const row = [...items, ...items];

  return (
    <div className="relative mt-20 overflow-hidden border-y border-border bg-muted/40 py-4">
      <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-10 whitespace-nowrap pr-10">
        {row.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-10 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            {item}
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="animate-[marquee"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
