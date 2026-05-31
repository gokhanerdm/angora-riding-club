const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Istanbul",
});

export function parseWeekOffset(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getWeekDays(weekOffset: number) {
  // Sunucu UTC'de çalışır; Istanbul saatini (UTC+3) baz alarak "bugün"ü hesapla
  const today = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" })
  );
  today.setHours(0, 0, 0, 0);

  const weekday = today.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;

  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

export function getWeekQueryRange(weekOffset: number) {
  const days = getWeekDays(weekOffset);
  const start = days[0];
  const end = new Date(days[6]);
  end.setDate(end.getDate() + 1);

  return { start, end, days };
}

export function toDayKey(date: Date) {
  return dayKeyFormatter.format(date);
}

export function formatDayHeader(date: Date, isToday: boolean) {
  const label = new Intl.DateTimeFormat("tr-TR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);

  return isToday ? `${label} · Bugün` : label;
}

export function formatWeekRange(days: Date[]) {
  const start = days[0];
  const end = days[6];
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${start.getDate()} – ${formatter.format(end)}`;
  }

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function groupLessonsByDay<T extends { starts_at: string }>(
  lessons: T[],
) {
  const grouped = new Map<string, T[]>();

  for (const lesson of lessons) {
    const key = toDayKey(new Date(lesson.starts_at));
    const existing = grouped.get(key);

    if (existing) {
      existing.push(lesson);
    } else {
      grouped.set(key, [lesson]);
    }
  }

  for (const dayLessons of grouped.values()) {
    dayLessons.sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }

  return grouped;
}
