import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireTrainer() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: trainer, error } = await supabase
    .from("trainers")
    .select("id, name, surname, user_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !trainer) {
    redirect("/unauthorized");
  }

  return {
    userId: user.id,
    trainerId: trainer.id,
    name: trainer.name,
    surname: trainer.surname,
  };
}
