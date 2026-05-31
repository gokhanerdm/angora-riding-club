'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Request {
  id: string
  member_name: string
  member_email: string
  lesson_count: number
  request_type: string
  price: number
  status: string
  created_at: string
}

interface Trainer {
  id: string
  name: string
  surname: string
}

export default function MembershipRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [approveModal, setApproveModal] = useState<Request | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'havale' | 'kart'>('nakit')
  const [selectedTrainer, setSelectedTrainer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadRequests()
    loadTrainers()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.rpc('get_membership_requests')
    if (data) setRequests(data)
    setLoading(false)
  }

  const loadTrainers = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('trainers')
      .select('id, name, surname')
      .is('deleted_at', null)
      .order('name')
    setTrainers(data ?? [])
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency', currency: 'TRY', minimumFractionDigits: 0
    }).format(price)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

  const handleApprove = (request: Request) => {
    setApproveModal(request)
    setPaymentAmount(request.price.toString())
    setPaymentMethod('nakit')
    setSelectedTrainer(trainers[0]?.id ?? '')
  }

  const handleReject = async (requestId: string) => {
    if (!confirm('Bu talebi reddetmek istediğinize emin misiniz?')) return
    const supabase = createClient()
    const { error } = await supabase
      .from('membership_requests')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', requestId)
    if (error) alert('Hata: ' + error.message)
    else loadRequests()
  }

  const handleConfirmApprove = async () => {
    if (!approveModal) return
    setSubmitting(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('approve_membership_request_with_payment', {
      admin_user_id: user.id,
      request_id: approveModal.id,
      payment_amount: parseFloat(paymentAmount),
      p_payment_method: paymentMethod,
      p_trainer_id: selectedTrainer || null
    })

    if (error) {
      alert('Hata: ' + error.message)
    } else {
      alert('Üyelik onaylandı!')
      setApproveModal(null)
      loadRequests()
    }
    setSubmitting(false)
  }

  if (loading) return <p>Yükleniyor...</p>

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const processedRequests = requests.filter(r => r.status !== 'pending')

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Üyelik Talepleri</h1>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Bekleyen Talepler ({pendingRequests.length})
        </h2>
        <div className="space-y-4">
          {pendingRequests.map(request => (
            <div key={request.id} className="bg-white p-6 rounded-xl shadow-sm border">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{request.member_name}</h3>
                  <p className="text-gray-600">{request.member_email}</p>
                  <p className="text-gray-500 text-sm">{formatDate(request.created_at)}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900 text-2xl">{request.lesson_count} Ders</div>
                  <div className="text-gray-600">{request.request_type === 'weekday' ? 'Hafta İçi' : 'Genel'}</div>
                  <div className="text-amber-600 font-bold text-xl">{formatPrice(request.price)}</div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleApprove(request)}
                  className="bg-green-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-green-700">
                  Onayla
                </button>
                <button onClick={() => handleReject(request.id)}
                  className="bg-red-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-red-700">
                  Reddet
                </button>
              </div>
            </div>
          ))}
          {pendingRequests.length === 0 && <p className="text-gray-500">Bekleyen talep yok.</p>}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">İşlenen Talepler</h2>
        <div className="space-y-2">
          {processedRequests.map(request => (
            <div key={request.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
              <div>
                <span className="font-bold text-gray-900">{request.member_name}</span>
                <span className="text-gray-600 ml-4">{request.lesson_count} Ders</span>
              </div>
              <span className={`px-3 py-1 rounded font-bold text-sm ${
                request.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {request.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {approveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Üyelik Onaylama</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-bold text-gray-900">{approveModal.member_name}</p>
              <p className="text-gray-600">{approveModal.lesson_count} Ders — {approveModal.request_type === 'weekday' ? 'Hafta İçi' : 'Genel'}</p>
              <p className="text-gray-500 text-sm">Liste fiyatı: {formatPrice(approveModal.price)}</p>
            </div>

            <div className="mb-4">
              <label className="block font-bold text-gray-900 mb-2">Eğitmen</label>
              <select value={selectedTrainer} onChange={e => setSelectedTrainer(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg text-gray-900">
                <option value="">Eğitmen seçin...</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} {t.surname}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block font-bold text-gray-900 mb-2">Ödeme Yöntemi</label>
              <div className="flex gap-2">
                {(['nakit', 'havale', 'kart'] as const).map(method => (
                  <button key={method} onClick={() => setPaymentMethod(method)}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${
                      paymentMethod === method
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}>
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block font-bold text-gray-900 mb-2">Ödenen Tutar (₺)</label>
              <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg text-gray-900" placeholder="0" />
            </div>

            <div className="flex gap-3">
              <button onClick={handleConfirmApprove} disabled={submitting}
                className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {submitting ? 'İşleniyor...' : 'Onayla'}
              </button>
              <button onClick={() => setApproveModal(null)} disabled={submitting}
                className="flex-1 bg-gray-200 text-gray-900 font-bold py-2 rounded-lg hover:bg-gray-300">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}