import { requireTrainer } from "@/lib/auth/server-protection";
import TrainerBottomNav from "@/components/trainer/TrainerBottomNav";
import LogoutButton from "@/components/logout-button";
import Link from "next/link";

export default async function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTrainer();

  return (
    <div style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)', minHeight: '100vh' }}>
      <header
        className="flex items-center justify-between px-5 pt-12 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Link href="/trainer">
          <p className="font-bold text-white text-lg leading-none">Angora</p>
          <p className="text-xs font-bold mt-0.5" style={{ color: '#f59e0b' }}>Eğitmen Paneli</p>
        </Link>
        <div style={{ color: '#7b93c4' }}>
          <LogoutButton />
        </div>
      </header>

      <main className="px-4 py-6 pb-28">
        {children}
      </main>

      <TrainerBottomNav />
    </div>
  );
}
