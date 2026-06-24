'use client'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'angora_rules_seen'

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div
        className="w-full rounded-t-3xl px-6 pt-6 pb-10"
        style={{ background: '#FBFBFB', border: '1px solid rgba(27,59,47,0.12)' }}
      >
        {/* Logo / başlık */}
        <div className="flex items-center gap-2 mb-5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
            style={{ background: 'rgba(245,158,11,0.15)' }}
          >🐴</div>
          <p className="text-sm font-bold text-[#1B3B2F]">Angora Binicilik Spor Kulübü</p>
        </div>

        <h2 className="text-lg font-bold text-[#1B3B2F] mb-4">Kullanım Kuralları</h2>

        <div className="space-y-4 mb-7">
          <div className="flex gap-3">
            <span className="text-xl leading-none mt-0.5">🐴</span>
            <p className="text-sm leading-relaxed" style={{ color: '#1B3B2F' }}>
              Derslerinizi en az <span className="font-bold text-[#1B3B2F]">12 saat öncesine</span> kadar iptal edebilirsiniz.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="text-xl leading-none mt-0.5">⏰</span>
            <p className="text-sm leading-relaxed" style={{ color: '#1B3B2F' }}>
              Derse gelmeniz halinde eğitmeniniz sizi bekleyecektir. Gelmezseniz dersiniz{' '}
              <span className="font-bold text-[#1B3B2F]">"Gelmedi"</span> olarak kayıtlara geçer ve ders hakkınızdan düşülür.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="text-xl leading-none mt-0.5">📅</span>
            <p className="text-sm leading-relaxed" style={{ color: '#1B3B2F' }}>
              Tesis her <span className="font-bold text-[#1B3B2F]">Pazartesi</span> kapalıdır.
            </p>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="w-full py-4 rounded-2xl text-sm font-bold text-[#1B3B2F]"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
        >
          Anladım, devam et
        </button>
      </div>
    </div>
  )
}
