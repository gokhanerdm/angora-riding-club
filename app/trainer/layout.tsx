import TrainerSidebar from "@/components/trainer-sidebar";
import { requireTrainer } from "@/lib/auth/server-protection";

export default async function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const trainer = await requireTrainer();

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="flex">
        <TrainerSidebar name={trainer.name} surname={trainer.surname} />

        <main className="flex-1 p-8 pt-20 md:pt-8">{children}</main>
      </div>
    </div>
  );
}
