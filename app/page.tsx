import Link from 'next/link'

const GREEN = '#1B3B2F'
const GREEN_SOFT = '#E8F0EA'
const BG = '#FBFBFB'
const MUTED = '#6B7280'

const FEATURES = [
  { icon: '🧒', label: '7 Yaş+' },
  { icon: '🛡️', label: 'Güvenli' },
  { icon: '🎓', label: 'Profesyonel Eğitmenler' },
]

export default function HomePage() {
  return (
    <main className="min-h-screen flex justify-center" style={{ background: BG }}>
      <div className="w-full max-w-md relative overflow-hidden">
        {/* Köşe yaprak süslemeleri */}
        <svg className="absolute -top-6 -left-10 w-40 h-40 opacity-70 pointer-events-none" viewBox="0 0 100 100" fill="none">
          <path d="M5 5 C30 10 45 25 50 50 C35 45 20 35 5 30 Z" fill="#7BA98A" opacity="0.5" />
          <path d="M2 20 C25 22 38 35 42 55 C28 50 15 42 2 40 Z" fill="#5C8A6E" opacity="0.4" />
        </svg>
        <svg className="absolute -bottom-6 -right-10 w-40 h-40 opacity-70 pointer-events-none" viewBox="0 0 100 100" fill="none">
          <path d="M95 95 C70 90 55 75 50 50 C65 55 80 65 95 70 Z" fill="#7BA98A" opacity="0.5" />
          <path d="M98 80 C75 78 62 65 58 45 C72 50 85 58 98 60 Z" fill="#5C8A6E" opacity="0.4" />
        </svg>

        {/* Logo */}
        <div className="pt-8 pb-3 flex justify-center relative z-10">
          <img src="/images/angora-emblem.png" alt="Angora Binicilik Spor Kulübü 2025" className="w-64" />
        </div>

        {/* Başlık */}
        <div className="px-6 pt-7 text-center">
          <h1 className="text-3xl font-extrabold leading-tight" style={{ color: GREEN }}>
            Biniciliğe ilk adımınızı atın.
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
            Güvenli ve profesyonel ortamda deneyim dolu bir yolculuğa başlayın.
          </p>
        </div>

        {/* Butonlar */}
        <div className="px-6 pt-6 space-y-3">
          <Link href="/signup?trial=1"
            className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl font-bold text-sm shadow-md"
            style={{ background: GREEN, color: '#fff' }}>
            <span className="text-lg">📅</span> ÜCRETSİZ DENEME DERSİ AL
          </Link>
          <Link href="/signup"
            className="flex items-center justify-center w-full h-14 rounded-2xl font-bold text-sm shadow-md"
            style={{ background: GREEN, color: '#fff' }}>
            KAYIT OL
          </Link>
          <Link href="/login"
            className="flex items-center justify-center w-full h-14 rounded-2xl font-bold text-sm shadow-md"
            style={{ background: GREEN, color: '#fff' }}>
            GİRİŞ YAP
          </Link>
        </div>

        {/* Özellik rozetleri */}
        <div className="px-6 pt-7 grid grid-cols-3 gap-3 text-center">
          {FEATURES.map(f => (
            <div key={f.label} className="rounded-2xl py-3" style={{ background: GREEN_SOFT }}>
              <div className="text-xl">{f.icon}</div>
              <p className="text-xs font-bold mt-1" style={{ color: GREEN }}>{f.label}</p>
            </div>
          ))}
        </div>

        {/* Tanıtım kartları */}
        <div className="px-6 pt-7 space-y-3">
          <div className="rounded-2xl overflow-hidden flex shadow-sm" style={{ background: '#fff', border: '1px solid rgba(27,59,47,0.10)' }}>
            <div className="flex-1 p-4">
              <p className="font-bold text-sm" style={{ color: GREEN }}>Manej Binişi</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>
                Kapalı manejde güvenli ve keyifli binicilik deneyimi.
              </p>
            </div>
            <div className="w-24 flex-shrink-0 flex items-center justify-center text-3xl" style={{ background: GREEN_SOFT }}>
              🏇
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden flex shadow-sm" style={{ background: '#fff', border: '1px solid rgba(27,59,47,0.10)' }}>
            <div className="flex-1 p-4">
              <p className="font-bold text-sm" style={{ color: GREEN }}>Safari / Yürüyüş Turu</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>
                Doğa ile iç içe unutulmaz bir tur.
              </p>
            </div>
            <div className="w-24 flex-shrink-0 relative" style={{ background: GREEN_SOFT }}>
              {[
                { top: '72%', left: '26%', scale: 0.8, opacity: 0.35 },
                { top: '54%', left: '54%', scale: 0.9, opacity: 0.55 },
                { top: '36%', left: '26%', scale: 1, opacity: 0.8 },
                { top: '16%', left: '52%', scale: 1.1, opacity: 1 },
              ].map((pos, i) => (
                <svg key={i} viewBox="0 0 24 24" className="absolute w-5 h-5"
                  style={{ top: pos.top, left: pos.left, transform: `scale(${pos.scale})`, opacity: pos.opacity }}
                  fill={GREEN}>
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 3 C7.5 3 4.5 6.2 4.5 10.5 C4.5 13.5 5.8 17.5 7 21 L9.5 21 C8.7 18 8 14.5 8 11.5 C8 8.5 9.5 6.5 12 6.5 C14.5 6.5 16 8.5 16 11.5 C16 14.5 15.3 18 14.5 21 L17 21 C18.2 17.5 19.5 13.5 19.5 10.5 C19.5 6.2 16.5 3 12 3 Z" />
                  <circle cx="7.2" cy="9.5" r="0.6" />
                  <circle cx="6.6" cy="13" r="0.6" />
                  <circle cx="16.8" cy="9.5" r="0.6" />
                  <circle cx="17.4" cy="13" r="0.6" />
                </svg>
              ))}
            </div>
          </div>
        </div>

        {/* Alt slogan */}
        <div className="px-6 py-9 text-center">
          <p className="text-sm font-bold tracking-wide" style={{ color: GREEN }}>
            🐴 Doğayla, Atlarla, Güvenle...
          </p>
        </div>
      </div>
    </main>
  )
}
