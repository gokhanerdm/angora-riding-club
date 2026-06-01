import { requireTrainer } from "@/lib/auth/server-protection";

export default async function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTrainer();
  return <>{children}</>;
}
