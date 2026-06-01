import { requireTrainer } from "@/lib/auth/server-protection";
import { createClient } from "@/lib/supabase/server";

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function formatDateTime(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS_TR[m - 1]} ${y} · ${time.substring(0, 5)}`
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Beklemede',
  approved:  'Onaylı',
  completed: 'Tamamlandı',
  no_show:   'Gelmedi',
  cancelled: 'İptal',
}

const STATUS_COLOR: Record<string, string> = {
  completed: '#34d399',
  no_show:   '#f59e0b',
  cancelled: '#f87171',
  pending:   '#7b93c4',
  approved:  '#38bdf8',
}

const CARD = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }

export default async function TrainerLessonsPage() {
  const trainer  = await requireTrainer();
  const supabase = await createClient();

  const { data: lessons } = await supabase
    .from("reservations")
    .select("id, scheduled_date, start_time, status, members(name, surname)")
    .eq("trainer_id", trainer.trainerId)
    .neq("status", "cancelled")
    .order("scheduled_date", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dersler</h1>

      <div className="rounded-2xl overflow-hidden" style={CARD}>
        {lessons && lessons.length > 0 ? (
          <ul>
            {(lessons as any[]).map((lesson, i) => {
              const member = Array.isArray(lesson.members) ? lesson.members[0] : lesson.members
              return (
                <li
                  key={lesson.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: i < lessons.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                >
                  <div>
                    <p className="text-sm font-bold text-white">
                      {formatDateTime(lesson.scheduled_date, lesson.start_time)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#7b93c4' }}>
                      {member ? `${member.name} ${member.surname}` : 'Bilinmiyor'}
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
                    style={{
                      color:      STATUS_COLOR[lesson.status] ?? '#7b93c4',
                      background: `${STATUS_COLOR[lesson.status] ?? '#7b93c4'}18`,
                    }}
                  >
                    {STATUS_LABELS[lesson.status] ?? lesson.status}
                  </span>
                </li>
              )
            })}
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
