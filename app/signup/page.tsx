'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { data, error: signupError } = await supabase.auth.signUp({ email, password })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: setupError } = await supabase.rpc('complete_signup', {
        p_user_id: data.user.id,
        p_name: name,
        p_surname: surname,
        p_email: email,
        p_phone: phone,
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

          {error && (
            <div className="px-4 py-3 rounded-2xl text-sm"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-2xl font-bold text-sm disabled:opacity-50 mt-2"
            style={{ background: '#f59e0b', color: '#0a0f2e' }}>
            {loading ? 'Kaydediliyor...' : 'Kayıt Ol'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: '#4a6190' }}>
          Hesabınız var mı?{' '}
          <Link href="/login" className="font-bold" style={{ color: '#f59e0b' }}>Giriş Yap</Link>
        </p>
      </div>
    </div>
  )
}
