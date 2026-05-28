import { requireAdmin } from '@/lib/auth/server-protection'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()
  
  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-8 lg:p-12 pt-20 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  )
}