export const SUBJECTS = [
  "Matematik",
  "Türkçe",
  "Fen Bilimleri",
  "T.C. İnkılap Tarihi",
  "Din Kültürü",
  "İngilizce",
  "Kitap",
  "Deneme",
  "Diğer",
] as const;

export type Subject = (typeof SUBJECTS)[number];

// Short labels for compact chips / charts
export const SUBJECT_SHORT: Record<string, string> = {
  Matematik: "Mat",
  Türkçe: "Türkçe",
  "Fen Bilimleri": "Fen",
  "T.C. İnkılap Tarihi": "İnkılap",
  "Din Kültürü": "Din",
  İngilizce: "İng",
  Kitap: "Kitap",
  Deneme: "Deneme",
  Diğer: "Diğer",
};

// Distinct chart colors (kept identical across light/dark on purpose for data series)
export const SUBJECT_COLORS: Record<string, string> = {
  Matematik: "#2563EB",
  Türkçe: "#DC2626",
  "Fen Bilimleri": "#059669",
  "T.C. İnkılap Tarihi": "#D97706",
  "Din Kültürü": "#7C3AED",
  İngilizce: "#0891B2",
  Kitap: "#DB2777",
  Deneme: "#EA580C",
  Diğer: "#64748B",
};

export function subjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] ?? "#64748B";
}
