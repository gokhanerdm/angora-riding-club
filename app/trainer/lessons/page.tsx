import { requireTrainer } from "@/lib/auth/server-protection";
import { createClient } from "@/lib/supabase/server";

const MONTHS_TR = ['Oca','Åub','Mar','Nis','May','Haz','Tem','AÄŸu','Eyl','Eki','Kas','Ara']

function formatDateTime(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS_TR[m - 1]} ${y} Â· ${time.substring(0, 5)}`
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Beklemede',
  approved:  'OnaylÄ±',
  completed: 'TamamlandÄ±',
  no_show:   'Gelmedi',
  cancelled: 'Ä°ptal',
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
    .select("id, scheduled_date, start_time, status, type, members(name, surname)")
    .eq("trainer_id", trainer.trainerId)
    .neq("status", "cancelled")
    .order("scheduled_date", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1B3B2F] mb-6">Dersler</h1>

      <div className="rounded-2xl overflow-hidden" style={CARD}>
        {lessons && lessons.length > 0 ? (
          <ul>
            {(lessons as any[]).map((lesson, i) => {
              const member = Array.isArray(lesson.members) ? lesson.members[0] : lesson.members
              const isTrial = lesson.type === 'trial'
              return (
                <li
                  key={lesson.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    borderBottom: i < lessons.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    background: isTrial ? 'rgba(245,158,11,0.1)' : undefined,
                  }}
                >
                  <div>
                    <p className="text-sm font-bold text-[#1B3B2F]">
                      {formatDateTime(lesson.scheduled_date, lesson.start_time)}
                      {isTrial && (
                        <span className="ml-1 px-1 py-0.5 rounded font-bold text-[9px]"
                          style={{ background: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>DD</span>
                      )}
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
            HenÃ¼z ders bulunmuyor.
          </p>
        )}
      </div>
    </div>
  );
}
