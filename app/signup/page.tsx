'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LegalDoc { title: string; content: string }

export default function SignupPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [surname, setSurname]   = useState('')
  const [phone, setPhone]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const [agreementChecked, setAgreementChecked] = useState(false)
  const [kvkkChecked, setKvkkChecked]           = useState(false)
  const [activeDoc, setActiveDoc]               = useState<LegalDoc | null>(null)
  const [docs, setDocs] = useState<Record<string, LegalDoc>>({})

  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.from('legal_documents').select('type, title, content').then(({ data }) => {
      if (data) {
        const map: Record<string, LegalDoc> = {}
        data.forEach(d => { map[d.type] = { title: d.title, content: d.content } })
        setDocs(map)
      }
    })
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreementChecked || !kvkkChecked) {
      setError('Devam etmek için sözleşme ve KVKK metnini onaylamanız gerekiyor.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: signupError } = await supabase.auth.signUp({ email, password })

    if (signupError) {
      if (signupError.message.toLowerCase().includes('already registered') ||
          signupError.message.toLowerCase().includes('already been registered') ||
          signupError.message.toLowerCase().includes('user already')) {
        setError('Bu email adresi zaten kayıtlı. Giriş yapmayı deneyin.')
      } else {
        setError('Kayıt başarısız: ' + signupError.message)
      }
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: setupError } = await supabase.rpc('complete_signup', {
        p_user_id: data.user.id,
        p_name: name, p_surname: surname, p_email: email, p_phone: phone,
      })
      if (setupError) {
        setError('Kayıt tamamlanamadı. Lütfen tekrar deneyin.')
        setLoading(false)
        return
      }
      router.push('/member')
    }
    setLoading(false)
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#c8d6f0',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Angora</h1>
          <p className="text-sm mt-1 font-bold" style={{ color: '#f59e0b' }}>Üye Kaydı</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Ad</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Soyad</label>
              <input type="text" value={surname} onChange={e => setSurname(e.target.value)} required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Telefon</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={inputStyle} />
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={inputStyle} />
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#7b93c4' }}>Şifre</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none" style={inputStyle} />
          </div>

          {/* Onay kutuları */}
          <div className="space-y-3 pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreementChecked}
                onChange={e => setAgreementChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-amber-400 flex-shrink-0"
              />
              <span className="text-xs leading-relaxed" style={{ color: '#7b93c4' }}>
                <button type="button" onClick={() => setActiveDoc(docs['membership_agreement'] ?? { title: 'Hizmet Sözleşmesi', content: 'Yükleniyor...' })}
                  className="font-bold underline" style={{ color: '#f59e0b' }}>
                  Hizmet Sözleşmesi
                </button>
                'ni okudum ve kabul ediyorum.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={kvkkChecked}
                onChange={e => setKvkkChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-amber-400 flex-shrink-0"
              />
              <span className="text-xs leading-relaxed" style={{ color: '#7b93c4' }}>
                <button type="button" onClick={() => setActiveDoc(docs['kvkk'] ?? { title: 'KVKK Aydınlatma Metni', content: 'Yükleniyor...' })}
                  className="font-bold underline" style={{ color: '#f59e0b' }}>
                  KVKK Aydınlatma Metni
                </button>
                'ni okudum ve onaylıyorum.
              </span>
            </label>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-2xl text-sm"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !agreementChecked || !kvkkChecked}
            className="w-full py-3 rounded-2xl font-bold text-sm disabled:opacity-40 mt-2"
            style={{ background: '#f59e0b', color: '#0a0f2e' }}>
            {loading ? 'Kaydediliyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: '#4a6190' }}>
          Hesabınız var mı?{' '}
          <Link href="/login" className="font-bold" style={{ color: '#f59e0b' }}>Giriş Yap</Link>
        </p>
      </div>

      {/* Metin modalı */}
      {activeDoc && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div
            className="w-full rounded-t-3xl flex flex-col"
            style={{ background: '#0d1b4b', maxHeight: '80vh', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div className="flex justify-between items-center px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-sm font-bold text-white">{activeDoc.title}</h3>
              <button onClick={() => setActiveDoc(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: '#c8d6f0' }}>
                {activeDoc.content}
              </p>
            </div>
            <div className="px-5 pb-6 pt-3 flex-shrink-0">
              <button onClick={() => setActiveDoc(null)}
                className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
