import { requireAdmin } from '@/lib/auth/server-protection'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div style={{ background: '#FBFBFB', minHeight: '100vh' }}>

      <main className="px-4 pt-14 pb-44">
        {children}
      </main>

      <AdminBottomNav />
    </div>
  )
}
