export const lessonStatusLabels: Record<string, string> = {
  completed: "Tamamlandı",
  scheduled: "Planlandı",
  confirmed: "Onaylandı",
  in_progress: "Devam ediyor",
  cancelled: "İptal",
};

export function formatLessonTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatLessonTimeOnly(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeStyle: "short",
  }).format(new Date(iso));
}

export function getLessonStatusLabel(status: string) {
  return lessonStatusLabels[status] ?? status;
}
