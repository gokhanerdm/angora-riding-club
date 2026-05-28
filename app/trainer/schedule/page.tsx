import Link from "next/link";
import { requireTrainer } from "@/lib/auth/server-protection";
import {
  formatWeekRange,
  getWeekQueryRange,
  parseWeekOffset,
  toDayKey,
} from "@/lib/lessons/week";
import { createClient } from "@/lib/supabase/server";
import TrainerScheduleClient from "./TrainerScheduleClient";

type PageProps = {
  searchParams: Promise<{ week?: string }>;
};

export default async function TrainerSchedulePage({ searchParams }: PageProps) {
  const trainer = await requireTrainer();
  const { week: weekParam } = await searchParams;
  const weekOffset = parseWeekOffset(weekParam);
  const { days } = getWeekQueryRange(weekOffset);
  const todayKey = toDayKey(new Date());

  const startDateStr = toDayKey(days[0]);
  const endDateStr = toDayKey(days[days.length - 1]);

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
      .select("scheduled_date, start_time, status, members(name, surname)")
      .eq("trainer_id", trainer.trainerId)
      .gte("scheduled_date", startDateStr)
      .lte("scheduled_date", endDateStr),
  ]);

  const closedSet = (closedSlots ?? []).map(
    (s: any) => `${s.scheduled_date}|${s.start_time}`
  );

  const reservationMap: Record<string, { member_name: string; status: string }> = {};
  for (const r of (reservations ?? []) as any[]) {
    const key = `${r.scheduled_date}|${r.start_time}`;
    const member = Array.isArray(r.members) ? r.members[0] : r.members;
    reservationMap[key] = {
      member_name: member ? `${member.name} ${member.surname}` : "Bilinmiyor",
      status: r.status,
    };
  }

  const dayInfos = days.map((d) => ({
    key: toDayKey(d),
    isToday: toDayKey(d) === todayKey,
  }));

  return (
    <div className="text-white">
      <h1 className="mb-6 text-3xl font-bold">Takvim</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-gray-300">{formatWeekRange(days)}</p>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/trainer/schedule?week=${weekOffset - 1}`}
            className="rounded bg-gray-700 px-3 py-2 text-gray-200 hover:bg-gray-600"
          >
            Önceki hafta
          </Link>
          {weekOffset !== 0 && (
            <Link
              href="/trainer/schedule"
              className="rounded bg-gray-700 px-3 py-2 text-gray-200 hover:bg-gray-600"
            >
              Bu hafta
            </Link>
          )}
          <Link
            href={`/trainer/schedule?week=${weekOffset + 1}`}
            className="rounded bg-gray-700 px-3 py-2 text-gray-200 hover:bg-gray-600"
          >
            Sonraki hafta
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