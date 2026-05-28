import { requireMember } from '@/lib/auth/server-protection'

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireMember()
  
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}