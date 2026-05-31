import { requireMember } from '@/lib/auth/server-protection'

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireMember()
  return <>{children}</>
}
