import Link from "next/link";
import { requireTrainer } from "@/lib/auth/server-protection";
import { formatWeekRange, getWeekQueryRange, parseWeekOffset, toDayKey } from "@/lib/lessons/week";
import { createClient } from "@/lib/supabase/server";
import TrainerScheduleClient from "./TrainerScheduleClient";

type PageProps = { searchParams: Promise<{ week?: string }> };

export default async function TrainerSchedulePage({ searchParams }: PageProps) {
  const trainer = await requireTrainer();
  const { week: weekParam } = await searchParams;
  const weekOffset = parseWeekOffset(weekParam);
  const { days } = getWeekQueryRange(weekOffset);
  const todayKey = toDayKey(new Date());

  const startDateStr = toDayKey(days[0]);
  const endDateStr   = toDayKey(days[days.length - 1]);

  const supabase = await createClient();

  const [{ data: closedSlots }, { data: reservations }] = await Promise.all([
    supabase
      .from("trainer_schedules")
      .select("scheduled_date, start_time")
      .eq("trainer_id", trainer.trainerId)
      .eq("is_available", false)
      .gte("scheduled_date", startDateStr)
      .lte("scheduled_date", endDateStr),
    supabase
      .from("reservations")
      .select("id, scheduled_date, start_time, status, members(name, surname)")
      .eq("trainer_id", trainer.trainerId)
      .gte("scheduled_date", startDateStr)
      .lte("scheduled_date", endDateStr),
  ]);

  const closedSet = (closedSlots ?? []).map(
    (s: any) => `${s.scheduled_date}|${s.start_time}`
  );

  const reservationMap: Record<string, { id: string; member_name: string; status: string }> = {};
  for (const r of (reservations ?? []) as any[]) {
    const key = `${r.scheduled_date}|${r.start_time}`;
    const member = Array.isArray(r.members) ? r.members[0] : r.members;
    reservationMap[key] = {
      id:          r.id,
      member_name: member ? `${member.name} ${member.surname}` : "Bilinmiyor",
      status:      r.status,
    };
  }

  const dayInfos = days.map((d) => ({
    key:     toDayKey(d),
    isToday: toDayKey(d) === todayKey,
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">Takvim</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold" style={{ color: '#c8d6f0' }}>{formatWeekRange(days)}</p>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/trainer/schedule?week=${weekOffset - 1}`}
            className="px-4 py-2 rounded-xl font-bold transition-opacity active:opacity-60"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            ←
          </Link>
          {weekOffset !== 0 && (
            <Link
              href="/trainer/schedule"
              className="px-4 py-2 rounded-xl font-bold"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              Bu hafta
            </Link>
          )}
          <Link
            href={`/trainer/schedule?week=${weekOffset + 1}`}
            className="px-4 py-2 rounded-xl font-bold transition-opacity active:opacity-60"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#7b93c4', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            →
          </Link>
        </div>
      </div>

      <TrainerScheduleClient
        trainerId={trainer.trainerId}
        days={dayInfos}
        closedSlots={closedSet}
        reservations={reservationMap}
      />
    </div>
  );
}
