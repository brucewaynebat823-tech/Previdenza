/** Grafico a torta (ad anello) con SVG. Le parti negative o nulle non vengono disegnate. */
export function Torta({ parti, descrizione }: { parti: { valore: number; colore: string }[]; descrizione: string }) {
  const R = 38;
  const C = 2 * Math.PI * R;
  const tot = parti.reduce((s, p) => s + Math.max(0, p.valore), 0) || 1;
  let usato = 0;
  return (
    <svg viewBox="0 0 100 100" className="torta" role="img" aria-label={descrizione}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="#e5e9f2" strokeWidth="20" />
      {parti.map((p, i) => {
        const len = (C * Math.max(0, p.valore)) / tot;
        const el = <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={p.colore} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-usato} transform="rotate(-90 50 50)" />;
        usato += len;
        return el;
      })}
    </svg>
  );
}
