import { requireAdmin } from '@/lib/auth/server-protection'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import LogoutButton from '@/components/logout-button'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)', minHeight: '100vh' }}>
      <header
        className="flex items-center justify-between px-5 pt-12 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Link href="/admin">
          <p className="font-bold text-white text-lg leading-none">Angora</p>
          <p className="text-xs font-bold mt-0.5" style={{ color: '#f59e0b' }}>Admin Paneli</p>
        </Link>
      </header>

      <main className="px-4 py-6 pb-44">
        {children}
      </main>

      <AdminBottomNav />

      {/* Çıkış — alt navigasyonun üstünde */}
      <div className="fixed bottom-16 left-0 right-0 flex justify-center z-[55] pb-1">
        <LogoutButton className="text-xs font-bold text-amber-400 px-4 py-1.5 rounded-xl transition-opacity hover:text-amber-300 opacity-50 hover:opacity-80" />
      </div>
    </div>
  )
}
