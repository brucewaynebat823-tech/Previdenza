/** Salvataggio locale (solo sul dispositivo). Mai inviato a server. */
const CHIAVE = 'previdenza.preventivo.v1';

export function carica<T>(): T | null {
  try {
    const s = localStorage.getItem(CHIAVE);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}
export function salva(v: unknown) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(v));
  } catch {
    /* archivio non disponibile (es. navigazione privata): l'app funziona comunque */
  }
}
export function cancella() {
  try {
    localStorage.removeItem(CHIAVE);
  } catch {
    /* niente da cancellare */
  }
}
export const numero = (s: string): number | null => {
  const t = s.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (t === '' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
