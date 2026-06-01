import { requireTrainer } from "@/lib/auth/server-protection";
import { formatLessonTime, getLessonStatusLabel } from "@/lib/lessons/display";
import { createClient } from "@/lib/supabase/server";

type LessonRow = { id: string; starts_at: string; status: string };

const STATUS_COLOR: Record<string, string> = {
  completed: '#34d399',
  cancelled:  '#f87171',
  no_show:    '#f59e0b',
  pending:    '#7b93c4',
  approved:   '#38bdf8',
}

export default async function TrainerLessonsPage() {
  const trainer = await requireTrainer();
  const supabase = await createClient();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, starts_at, status")
    .eq("trainer_id", trainer.trainerId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })
    .returns<LessonRow[]>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dersler</h1>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {lessons && lessons.length > 0 ? (
          <ul>
            {lessons.map((lesson, i) => (
              <li
                key={lesson.id}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: i < lessons.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
              >
                <span className="text-sm" style={{ color: '#c8d6f0' }}>
                  {formatLessonTime(lesson.starts_at)}
                </span>
                <span className="text-xs font-bold" style={{ color: STATUS_COLOR[lesson.status] ?? '#7b93c4' }}>
                  {getLessonStatusLabel(lesson.status)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center py-10 text-sm" style={{ color: '#7b93c4' }}>
            Henüz ders bulunmuyor.
          </p>
        )}
      </div>
    </div>
  );
}
