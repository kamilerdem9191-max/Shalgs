const MONTHS_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const DAYS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "2025-09-09" -> "9 Eylül"
export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_TR[m - 1]}`;
}

// "2025-09-09" -> "9 Eylül Salı" (with relative today/yesterday)
export function formatDateLong(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Bugün";
  const dt = new Date(iso + "T00:00:00");
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yy = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  if (iso === yy) return "Dün";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_TR[m - 1]} ${DAYS_TR[dt.getDay()]}`;
}

export function formatDateTime(isoDateTime: string): string {
  const dt = new Date(isoDateTime);
  const d = dt.getDate();
  const m = MONTHS_TR[dt.getMonth()];
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${d} ${m}, ${hh}:${mm}`;
}
