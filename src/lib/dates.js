// Fechas locales como texto "YYYY-MM-DD" (evita problemas de zona horaria)

export function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  
  export function fromISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  
  export function todayISO() {
    return toISO(new Date());
  }
  
  export function addDays(iso, n) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  
  export function diffDays(aISO, bISO) {
    const ms = fromISO(bISO).getTime() - fromISO(aISO).getTime();
    return Math.round(ms / 86400000);
  }
  
  export function weekday(iso) {
    return fromISO(iso).getDay(); // 0 = domingo
  }
  
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  
  export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  export function formatLong(iso) {
    const d = fromISO(iso);
    return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
  }
  
  export function formatShort(iso) {
    const d = fromISO(iso);
    return `${d.getDate()} ${MESES[d.getMonth()]}`;
  }
  
  export function relativeLabel(iso) {
    const diff = diffDays(todayISO(), iso);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff === -1) return 'Ayer';
    return formatLong(iso);
  }