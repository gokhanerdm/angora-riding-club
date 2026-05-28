import { requireTrainer } from "@/lib/auth/server-protection";
import {
  formatLessonTime,
  getLessonStatusLabel,
} from "@/lib/lessons/display";
import { createClient } from "@/lib/supabase/server";

type LessonRow = {
  id: string;
  starts_at: string;
  status: string;
};

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
    <div className="text-white">
      <h1 className="mb-6 text-3xl font-bold">Dersler</h1>

      <div className="rounded-lg bg-gray-800 p-6">
        {lessons && lessons.length > 0 ? (
          <ul className="divide-y divide-gray-700">
            {lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <span className="text-gray-300">
                  {formatLessonTime(lesson.starts_at)}
                </span>
                <span className="text-sm text-gray-400">
                  {getLessonStatusLabel(lesson.status)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">Henüz ders bulunmuyor.</p>
        )}
      </div>
    </div>
  );
}
