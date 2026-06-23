'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Request {
  id: string; member_name: string; member_email: string
  lesson_count: number; request_type: string; price: number
  status: string; created_at: string
}

interface Trainer { id: string; name: string; surname: string }

const CARD = { background: 'rgba(27,59,47,0.06)', border: '1px solid rgba(27,59,47,0.10)' }
const INPUT_STYLE = { background: 'rgba(27,59,47,0.04)', border: '1px solid rgba(27,59,47,0.15)', color: '#1B3B2F' }

export default function MembershipRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [approveModal, setApproveModal] = useState<Request | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'havale' | 'kart'>('nakit')
  const [selectedTrainer, setSelectedTrainer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadRequests(); loadTrainers() }, [])

  const loadRequests = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.rpc('get_membership_requests')
    if (data) setRequests(data)
    setLoading(false)
  }

  const loadTrainers = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('trainers').select('id, name, surname').is('deleted_at', null).order('name')
    setTrainers(data ?? [])
  }

  const formatPrice = (p: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(p)
  const formatDate = (d: string) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const handleApprove = (req: Request) => { setApproveModal(req); setPaymentAmount(req.price.toString()); setPaymentMethod('nakit'); setSelectedTrainer(trainers[0]?.id ?? '') }

  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleReject = async () => {
    if (!rejectTarget) return
    setRejecting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.rpc('reject_membership_request', { p_admin_id: user?.id, p_request_id: rejectTarget })
    setRejecting(false)
    setRejectTarget(null)
    if (error) showToast('Hata: ' + error.message)
    else loadRequests()
  }

  const handleConfirmApprove = async () => {
    if (!approveModal) return
    setSubmitting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('approve_membership_request_with_payment', { admin_user_id: user.id, request_id: approveModal.id, payment_amount: parseFloat(paymentAmount), p_payment_method: paymentMethod, p_trainer_id: selectedTrainer || null })
    if (error) showToast('Hata: ' + error.message)
    else { setApproveModal(null); loadRequests() }
    setSubmitting(false)
  }

  if (loading) return <p className="text-center py-8" style={{ color: 'rgba(27,59,47,0.55)' }}>Yükleniyor...</p>

  const pending   = requests.filter(r => r.status === 'pending')
  const processed = requests.filter(r => r.status !== 'pending')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Üyelik Talepleri</h1>

      <p className="text-sm font-bold mb-3" style={{ color: 'rgba(27,59,47,0.55)' }}>Bekleyen Talepler ({pending.length})</p>
      <div className="space-y-3 mb-8">
        {pending.length === 0 && <p style={{ color: 'rgba(27,59,47,0.4)' }}>Bekleyen talep yok.</p>}
        {pending.map(r => (
          <div key={r.id} className="rounded-2xl p-4" style={CARD}>
            <div className="flex justify-between items-start mb-3 gap-2">
              <div>
                <p className="font-bold">{r.member_name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(27,59,47,0.55)' }}>{r.member_email}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(27,59,47,0.4)' }}>{formatDate(r.created_at)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold">{r.lesson_count}</p>
                <p className="text-xs" style={{ color: 'rgba(27,59,47,0.55)' }}>{r.request_type === 'weekday' ? 'Hafta İçi' : 'Genel'}</p>
                <p className="font-bold" style={{ color: '#f59e0b' }}>{formatPrice(r.price)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleApprove(r)}
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                Onayla
              </button>
              <button onClick={() => setRejectTarget(r.id)}
                className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                Reddet
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm font-bold mb-3" style={{ color: 'rgba(27,59,47,0.55)' }}>İşlenen Talepler</p>
      <div className="space-y-2">
        {processed.map(r => (
          <div key={r.id} className="rounded-2xl p-4 flex justify-between items-center" style={CARD}>
            <div>
              <span className="font-bold">{r.member_name}</span>
              <span className="text-xs ml-3" style={{ color: 'rgba(27,59,47,0.55)' }}>{r.lesson_count} Ders</span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg"
              style={r.status === 'approved'
                ? { background: 'rgba(52,211,153,0.15)', color: '#34d399' }
                : { background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
              {r.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
            </span>
          </div>
        ))}
      </div>

      {approveModal && (
        <div className="fixed inset-0 z-[70] flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full rounded-t-3xl p-6 pb-10" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="text-lg font-bold mb-4">Üyelik Onaylama</h3>
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(27,59,47,0.05)' }}>
              <p className="font-bold">{approveModal.member_name}</p>
              <p className="text-sm mt-0.5" style={{ color: 'rgba(27,59,47,0.55)' }}>{approveModal.lesson_count} Ders — {approveModal.request_type === 'weekday' ? 'Hafta İçi' : 'Genel'}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(27,59,47,0.4)' }}>Liste fiyatı: {formatPrice(approveModal.price)}</p>
            </div>

            <p className="text-xs font-bold mb-2" style={{ color: 'rgba(27,59,47,0.55)' }}>Eğitmen</p>
            <select value={selectedTrainer} onChange={e => setSelectedTrainer(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4" style={INPUT_STYLE}>
              <option value="">Seçin...</option>
              {trainers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
            </select>

            <p className="text-xs font-bold mb-2" style={{ color: 'rgba(27,59,47,0.55)' }}>Ödeme Yöntemi</p>
            <div className="flex gap-2 mb-4">
              {(['nakit','havale','kart'] as const).map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold capitalize"
                  style={paymentMethod === m ? { background: '#f59e0b', color: '#0a0f2e' } : INPUT_STYLE}>
                  {m}
                </button>
              ))}
            </div>

            <p className="text-xs font-bold mb-2" style={{ color: 'rgba(27,59,47,0.55)' }}>Ödenen Tutar (₺)</p>
            <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
              placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4" style={INPUT_STYLE} />

            {!selectedTrainer && (
              <p className="text-xs font-bold mb-3 text-center" style={{ color: '#f59e0b' }}>
                ⚠️ Onaylamak için eğitmen seçimi zorunludur.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={handleConfirmApprove} disabled={submitting || !selectedTrainer}
                className="flex-1 py-3 rounded-xl font-bold disabled:opacity-50"
                style={{ background: '#34d399', color: '#0a0f2e' }}>
                {submitting ? 'İşleniyor...' : 'Onayla'}
              </button>
              <button onClick={() => setApproveModal(null)} disabled={submitting}
                className="flex-1 py-3 rounded-xl font-bold disabled:opacity-50"
                style={{ background: 'rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reddet onay modalı */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[70] flex items-end" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <h3 className="text-lg font-bold mb-2">Talebi Reddet</h3>
            <p className="text-sm mb-6" style={{ color: 'rgba(27,59,47,0.55)' }}>Bu üyelik talebini reddetmek istediğinize emin misiniz?</p>
            <div className="flex gap-3">
              <button onClick={() => setRejectTarget(null)} disabled={rejecting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(27,59,47,0.08)', color: 'rgba(27,59,47,0.55)' }}>Vazgeç</button>
              <button onClick={handleReject} disabled={rejecting}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
                {rejecting ? '...' : 'Reddet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-2xl text-sm font-bold"
          style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
