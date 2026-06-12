import Link from 'next/link'

const BG = '#FBFBFB'
const GREEN = '#1B3B2F'
const GREEN_SOFT = '#E8F0EA'
const MUTED = '#6B7280'

export default function TrialLessonPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: BG }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-5" style={{ background: GREEN_SOFT }}>
        📅
      </div>
      <h1 className="text-xl font-bold" style={{ color: GREEN }}>Deneme Dersi Takvimi</h1>
      <p className="text-sm mt-2 leading-relaxed" style={{ color: MUTED }}>
        Deneme dersi tarih ve saat seçim ekranı yakında burada olacak.
      </p>
      <Link href="/member"
        className="mt-8 px-6 py-3 rounded-2xl font-bold text-sm"
        style={{ background: GREEN, color: '#fff' }}>
        Üye Paneline Git
      </Link>
    </div>
  )
}
