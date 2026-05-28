import { requireTrainer } from "@/lib/auth/server-protection";
import { createClient } from "@/lib/supabase/server";
import TrainerDashboardClient from "./TrainerDashboardClient";

type TrainerStats = {
  today_lessons: number;
  week_lessons: number;
  completed_lessons: number;
};

export default async function TrainerDashboardPage() {
  const trainer = await requireTrainer();
  const supabase = await createClient();

  const { data: statsData } = await supabase
    .rpc("get_trainer_stats", { p_trainer_id: trainer.trainerId })
    .single<TrainerStats>();

  const stats = statsData ?? {
    today_lessons: 0,
    week_lessons: 0,
    completed_lessons: 0,
  };

  return (
    <TrainerDashboardClient
      trainerId={trainer.trainerId}
      trainerName={trainer.name}
      stats={stats}
    />
  );
}