export const eur = (n: number) => '€ ' + Math.round(n).toLocaleString('it-IT', { useGrouping: 'always' } as Intl.NumberFormatOptions);
export const pct = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? '—' : n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%');
export const dataIt = (iso: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('it-IT') : null);
