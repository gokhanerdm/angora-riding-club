'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const BG       = '#FBFBFB'
const GREEN    = '#1B3B2F'
const GREEN_SOFT = '#E8F0EA'

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [saving,   setSaving]     = useState(false)
  const [error,    setError]      = useState('')
  const [done,     setDone]       = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      return
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateErr) {
      setError('Şifre güncellenemedi: ' + updateErr.message)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  const inputStyle = {
    background: GREEN_SOFT,
    border: '1px solid rgba(27,59,47,0.10)',
    color: GREEN,
  }

  return (
    <div className="flex items-center justify-center p-4" style={{ minHeight: '100dvh', background: BG }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl"
            style={{ background: GREEN_SOFT }}>🔑</div>
          <h1 className="text-2xl font-bold" style={{ color: GREEN }}>Yeni Şifre</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Hesabın için yeni bir şifre belirle</p>
        </div>

        {done ? (
          <div className="px-4 py-4 rounded-2xl text-sm text-center font-medium"
            style={{ background: 'rgba(52,211,153,0.12)', color: '#15803d', border: '1px solid rgba(52,211,153,0.3)' }}>
            ✓ Şifren güncellendi. Giriş sayfasına yönlendiriliyorsun...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#6B7280' }}>Yeni Şifre</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-2" style={{ color: '#6B7280' }}>Şifre Tekrar</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Şifreyi tekrar gir"
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={inputStyle}
              />
            </div>
            {error && (
              <p className="text-xs px-1" style={{ color: '#dc2626' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50"
              style={{ background: GREEN, color: '#fff' }}
            >
              {saving ? 'Kaydediliyor...' : 'Şifremi Güncelle'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
