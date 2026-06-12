import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TrialLessonCalendar from '@/components/member/TrialLessonCalendar'

const BG = '#FBFBFB'
const GREEN = '#1B3B2F'
const MUTED = '#6B7280'

export default async function TrialLessonPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('trial_lesson_requested, trial_lesson_used')
    .eq('user_id', user.id)
    .single()

  if (!member?.trial_lesson_requested || member.trial_lesson_used) {
    redirect('/member')
  }

  return (
    <div className="min-h-screen px-4 pt-8" style={{ background: BG }}>
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold" style={{ color: GREEN }}>Deneme Dersi Takvimi</h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>
          Ücretsiz deneme dersiniz için uygun bir tarih ve saat seçin.
        </p>
      </div>
      <TrialLessonCalendar />
    </div>
  )
}
