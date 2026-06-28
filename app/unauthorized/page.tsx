import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function UnauthorizedPage() {
  // Giriş yapmış kullanıcı yanlış panele düşmüşse çıkmaz sokak gösterme,
  // rolüne göre doğru paneline yönlendir.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') redirect('/admin')
    if (profile?.role === 'trainer') {
      // Sadece gerçek trainer kaydı varsa yönlendir, yoksa loop olur
      const { data: t } = await supabase.from('trainers').select('id').eq('user_id', user.id).is('deleted_at', null).single()
      if (t) redirect('/trainer')
    }
    if (profile?.role === 'member') redirect('/member')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="rounded-3xl p-8 mb-6"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
        >
          <p className="text-5xl mb-4">🔒</p>
          <h1 className="text-xl font-bold text-white mb-2">Erişim Reddedildi</h1>
          <p className="text-sm" style={{ color: '#7b93c4' }}>Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </div>
        <Link
          href="/login"
          className="inline-block w-full py-3 rounded-2xl font-bold text-sm"
          style={{ background: '#f59e0b', color: '#0a0f2e' }}
        >
          Giriş Sayfasına Dön
        </Link>
      </div>
    </div>
  )
}
