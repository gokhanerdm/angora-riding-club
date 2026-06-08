// Bu sayfa giriş yapmamış ziyaretçiler için karşılama ekranı taslağıdır (preview).
// Gerçek auth/database bağlantısı YOKTUR — sadece görsel taslak amaçlıdır.
// Mevcut sisteme entegre değildir, mevcut route'ları (signup dahil) etkilemez.

const FEATURES = [
  { label: '7 Yaş+' },
  { label: 'Güvenli' },
  { label: 'Eğitmenli' },
]

const GREEN = '#0F5C3A'
const GREEN_BG = '#EAF4EC'
const GREEN_SOFT_BG = '#EEF7F1'
const PAGE_BG = '#F8FAF8'
const MUTED = '#6B7280'

export default function PublicPreviewPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10" style={{ background: PAGE_BG }}>
      <div className="w-full max-w-sm rounded-[32px] shadow-xl overflow-hidden border"
        style={{ background: '#fff', borderColor: 'rgba(15,92,58,0.12)' }}>

        {/* Görsel alanı */}
        <div className="relative h-64" style={{ background: GREEN_BG }}>
          <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-50">🐴</div>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.15), rgba(15,92,58,0.72))' }} />
          <div className="absolute top-5 left-5 rounded-full px-4 py-2 text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.92)', color: GREEN }}>
            ANGORA
          </div>
          <div className="absolute bottom-4 right-4 text-[10px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.85)', color: GREEN }}>
            📷 görsel alanı
          </div>
        </div>

        {/* İçerik */}
        <section className="p-6 space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GREEN }}>
              Angora Binicilik Spor Kulübü
            </p>
            <h1 className="text-3xl font-bold leading-tight" style={{ color: '#1A1A1A' }}>
              Biniciliğe İlk Adımınızı Atın
            </h1>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
              Güvenli, profesyonel ve aile dostu ortamda deneme dersi için kayıt olun.
            </p>
          </div>

          <a href="/signup" className="block w-full h-14 rounded-2xl font-semibold text-base shadow-md flex items-center justify-center"
            style={{ background: GREEN, color: '#fff' }}>
            Deneme Dersi Al
          </a>

          <a href="/signup" className="block w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center"
            style={{ background: GREEN_SOFT_BG, color: GREEN }}>
            Kayıt Ol
          </a>

          <a href="/login" className="block w-full text-center text-sm font-medium" style={{ color: MUTED }}>
            Zaten üyeyim, giriş yap
          </a>

          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            {FEATURES.map(f => (
              <div key={f.label} className="rounded-2xl p-3" style={{ background: PAGE_BG }}>
                <p className="text-xs font-medium" style={{ color: MUTED }}>{f.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
