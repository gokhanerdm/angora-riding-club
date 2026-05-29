'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']

type Trainer = {
  id: string
  name: string
  surname: string
  email: string
  phone: string
  specialization: string | null
  bonus_rate: number
  hourly_rate: number
}

type TrainerDetail = {
  members: any[]
  monthStats: { month: number; year: number; lesson_count: number; prim: number }[]
  pendingPrim: number
}

export default function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Trainer | null>(null)
  const [detail, setDetail] = useState<TrainerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editBonus, setEditBonus] = useState<string>('')
  const [primPayModal, setPrimPayModal] = useState(false)
  const [primAmount, setPrimAmount] = useState('')
  const [primMethod, setPrimMethod] = useState<'nakit' | 'havale' | 'kart'>('nakit')
  const [allMembers, setAllMembers] = useState<any[]>([])

  useEffect(() => { loadTrainers(); loadAllMembers() }, [])

  const loadTrainers = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('trainers')
      .select('id, name, surname, email, phone, specialization, bonus_rate, hourly_rate')
      .is('deleted_at', null)
      .order('name')
    setTrainers(data ?? [])
    setLoading(false)
  }

  const loadAllMembers = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('members').select('id, name, surname').is('deleted_at', null)
    setAllMembers(data ?? [])
  }

  const loadDetail = async (trainer: Trainer) => {
    setSelected(trainer)
    setEditBonus(trainer.bonus_rate?.toString() ?? '0')
    setDetailLoading(true)
    const supabase = createClient()

    const [{ data: allowedMembers }, { data: reservations }, { data: memberships }] = await Promise.all([
      supabase.from('member_allowed_trainers').select('member_id').eq('trainer_id', trainer.id),
      supabase.from('reservations').select('scheduled_date, member_id, status, memberships(lesson_price_snapshot)')
        .eq('trainer_id', trainer.id).in('status', ['completed', 'no_show']),
      supabase.from('memberships').select('member_id, lesson_price_snapshot').eq('is_current', true)
    ])

    const memberIds = (allowedMembers ?? []).map((r: any) => r.member_id)
    const { data: membersData } = await supabase.from('members').select('id, name, surname').in('id', memberIds)

    // Aylık istatistik
    const map = new Map<string, { count: number; prim: number }>()
    for (const r of reservations ?? []) {
      const d = new Date(r.scheduled_date + 'T00:00:00')
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const membership = Array.isArray(r.memberships) ? r.memberships[0] : r.memberships
      const lessonPrice = membership?.lesson_price_snapshot ?? 0
      const prim = lessonPrice * ((trainer.bonus_rate ?? 0) / 100)
      const current = map.get(key) ?? { count: 0, prim: 0 }
      map.set(key, { count: current.count + 1, prim: current.prim + prim })
    }

    const monthStats = Array.from(map.entries()).map(([key, val]) => {
      const [year, month] = key.split('-').map(Number)
      return { year, month, lesson_count: val.count, prim: val.prim }
    }).sort((a, b) => b.year - a.year || b.month - a.month)

    const totalPrim = monthStats.reduce((sum, m) => sum + m.prim, 0)

    // Ödenen prim
    const { data: payments } = await supabase
      .from('payment_transactions')
      .select('amount')
      .eq('membership_id', '00000000-0000-0000-0000-000000000000') // trainer prim ödemeleri için ayrı tablo gerekecek

    setDetail({
      members: membersData ?? [],
      monthStats,
      pendingPrim: totalPrim
    })
    setDetailLoading(false)
  }

  const updateBonusRate = async () => {
    if (!selected) return
    const supabase = createClient()
    await supabase.from('trainers').update({ bonus_rate: parseFloat(editBonus) }).eq('id', selected.id)
    await loadTrainers()
    alert('Prim oranı güncellendi.')
  }

  const toggleMember = async (memberId: string, isAdded: boolean) => {
    if (!selected) return
    const supabase = createClient()
    if (isAdded) {
      await supabase.from('member_allowed_trainers').delete()
        .eq('trainer_id', selected.id).eq('member_id', memberId)
    } else {
      await supabase.from('member_allowed_trainers').insert({ trainer_id: selected.id, member_id: memberId })
    }
    await loadDetail(selected)
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Sol: liste */}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Eğitmenler</h1>

        {loading ? <p className="text-gray-500">Yükleniyor...</p> : (
          <div className="space-y-2">
            {trainers.map(trainer => (
              <button key={trainer.id} onClick={() => loadDetail(trainer)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${selected?.id === trainer.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900">{trainer.name} {trainer.surname}</p>
                    <p className="text-sm text-gray-500">{trainer.email}</p>
                    {trainer.specialization && <p className="text-xs text-gray-400">{trainer.specialization}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-600">%{trainer.bonus_rate ?? 0} Prim</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sağ: detay */}
      {selected && (
        <div className="w-96 flex-shrink-0 bg-white border border-gray-200 rounded-2xl p-5 overflow-y-auto max-h-[calc(100vh-8rem)]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selected.name} {selected.surname}</h2>
              <p className="text-sm text-gray-500">{selected.email}</p>
              <p className="text-sm text-gray-500">{selected.phone}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-xl font-bold">✕</button>
          </div>

          {/* Prim oranı */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <label className="text-xs text-gray-500 font-bold mb-1 block">Prim Oranı (%)</label>
            <div className="flex gap-2">
              <input type="number" value={editBonus} onChange={e => setEditBonus(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-900" />
              <button onClick={updateBonusRate}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-700">
                Kaydet
              </button>
            </div>
          </div>

          {detailLoading ? <p className="text-gray-400 text-center py-4">Yükleniyor...</p> : detail && (
            <>
              {/* Aylık istatistik */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Aylık Dersler & Prim</h3>
                {detail.monthStats.length === 0
                  ? <p className="text-xs text-gray-400">Veri yok.</p>
                  : detail.monthStats.map(s => (
                    <div key={`${s.year}-${s.month}`} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm font-bold text-gray-900">{MONTHS_TR[s.month]} {s.year}</span>
                      <div className="text-right">
                        <p className="text-sm text-gray-700">{s.lesson_count} ders</p>
                        <p className="text-xs text-amber-600 font-bold">{s.prim.toLocaleString('tr-TR')} ₺</p>
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Üye listesi */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Atanmış Üyeler</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
                  {detail.members.length === 0
                    ? <p className="text-xs text-gray-400">Atanmış üye yok.</p>
                    : detail.members.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-900">{m.name} {m.surname}</span>
                        <button onClick={() => toggleMember(m.id, true)}
                          className="text-xs text-red-500 hover:text-red-700 font-bold">Çıkar</button>
                      </div>
                    ))
                  }
                </div>

                {/* Üye ekle */}
                <select onChange={e => { if (e.target.value) toggleMember(e.target.value, false); e.target.value = '' }}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-gray-900">
                  <option value="">Üye ekle...</option>
                  {allMembers
                    .filter(m => !detail.members.find(dm => dm.id === m.id))
                    .map(m => <option key={m.id} value={m.id}>{m.name} {m.surname}</option>)
                  }
                </select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}