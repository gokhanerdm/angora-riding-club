'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const MONTHS_S  = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtTL(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))
}
function initials(name: string, surname: string) {
  return `${name[0] ?? ''}${surname[0] ?? ''}`.toUpperCase()
}

type TrainerRow = {
  id: string; name: string; surname: string; photo: string | null; bonusRate: number
  dersMonth: number; activeMembers: number; primMonth: number; successRate: number
}
type ChartPoint = { day: number; cumulative: number }
type PendingMember = { id: string; name: string; surname: string; photo: string | null; packageName: string; endDate: string; amount: number }

export default function PaymentsPage() {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [summary, setSummary]     = useState({ gelirToday: 0, gelirYesterday: 0, dersToday: 0, dersYesterday: 0, paketToday: 0, paketYesterday: 0, primToday: 0, primYesterday: 0 })
  const [chart, setChart]         = useState<ChartPoint[]>([])
  const [trainers, setTrainers]   = useState<TrainerRow[]>([])
  const [pending, setPending]     = useState<PendingMember[]>([])
  const [loading, setLoading]     = useState(true)

  const [showDetail, setShowDetail] = useState(false)
  const [detailData, setDetailData] = useState<any>(null)

  useEffect(() => { load() }, [viewMonth])

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const todayStr     = toDateStr(today)
    const yesterday    = new Date(today); yesterday.setDate(today.getDate()-1)
    const yestStr      = toDateStr(yesterday)
    const monthStart   = `${viewMonth.y}-${String(viewMonth.m+1).padStart(2,'0')}-01`
    const monthEnd     = toDateStr(new Date(viewMonth.y, viewMonth.m+1, 1))
    const daysInMonth  = new Date(viewMonth.y, viewMonth.m+1, 0).getDate()

    const [
      { data: ptToday }, { data: ptYest }, { data: ptMonth },
      { data: resToday }, { data: resYest }, { data: resMonth },
      { data: msToday }, { data: msYest },
      { data: trainerList },
      { data: membersAll },
      { data: allowedTrainers },
      { data: endingSoon },
    ] = await Promise.all([
      supabase.from('payment_transactions').select('amount').is('deleted_at', null).eq('payment_date', todayStr),
      supabase.from('payment_transactions').select('amount').is('deleted_at', null).eq('payment_date', yestStr),
      supabase.from('payment_transactions').select('amount, payment_date').is('deleted_at', null).gte('payment_date', monthStart).lt('payment_date', monthEnd),
      supabase.from('reservations').select('id, trainer_id, memberships(lesson_price_snapshot, member_id, trainers(bonus_rate))').in('status',['completed','no_show']).eq('scheduled_date', todayStr),
      supabase.from('reservations').select('id').in('status',['completed','no_show']).eq('scheduled_date', yestStr),
      supabase.from('reservations').select('id, trainer_id, memberships(lesson_price_snapshot)').in('status',['completed','no_show']).gte('scheduled_date', monthStart).lt('scheduled_date', monthEnd),
      supabase.from('memberships').select('id').gte('start_date', todayStr).lte('start_date', todayStr),
      supabase.from('memberships').select('id').gte('start_date', yestStr).lte('start_date', yestStr),
      supabase.from('trainers').select('id, name, surname, bonus_rate, profile_photo_url').is('deleted_at', null).order('name'),
      supabase.from('members').select('id, name, surname, profile_photo_url, default_trainer_id').is('deleted_at', null),
      supabase.from('member_allowed_trainers').select('member_id, trainer_id'),
      supabase.from('memberships').select('member_id, total_lessons, end_date, start_date, members(name, surname, profile_photo_url), payment_transactions(amount)').gte('end_date', todayStr).lte('end_date', toDateStr(new Date(today.getTime() + 30 * 86400000))).eq('is_current', true).order('end_date'),
    ])

    // Özet
    const gelirToday     = (ptToday ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
    const gelirYesterday = (ptYest  ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
    const primToday      = (resToday ?? []).reduce((s: number, r: any) => {
      const ms = Array.isArray(r.memberships) ? r.memberships[0] : r.memberships
      const t  = Array.isArray(ms?.trainers) ? ms?.trainers[0] : ms?.trainers
      return s + ((ms?.lesson_price_snapshot ?? 0) * ((t?.bonus_rate ?? 0) / 100))
    }, 0)
    const primYesterday = 0
    setSummary({ gelirToday, gelirYesterday, dersToday: (resToday??[]).length, dersYesterday: (resYest??[]).length, paketToday: (msToday??[]).length, paketYesterday: (msYest??[]).length, primToday, primYesterday })

    // Grafik — kümülatif gelir
    const dailyMap = new Map<number, number>()
    for (const pt of ptMonth ?? []) {
      const d = parseInt((pt.payment_date as string).split('-')[2])
      dailyMap.set(d, (dailyMap.get(d) ?? 0) + (pt.amount ?? 0))
    }
    let cum = 0
    const chartPoints: ChartPoint[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      cum += dailyMap.get(d) ?? 0
      chartPoints.push({ day: d, cumulative: cum })
    }
    setChart(chartPoints)

    // Eğitmen performansı
    const trainerRows: TrainerRow[] = (trainerList ?? []).map((t: any) => {
      const myRes = (resMonth ?? []).filter((r: any) => r.trainer_id === t.id)
      const totalRes = myRes.length
      const completedRes = myRes.length // all counted
      const prim = myRes.reduce((s: number, r: any) => {
        const ms = Array.isArray(r.memberships) ? r.memberships[0] : r.memberships
        return s + ((ms?.lesson_price_snapshot ?? 0) * ((t.bonus_rate ?? 0) / 100))
      }, 0)
      const myMembers = new Set([
        ...(membersAll ?? []).filter((m: any) => m.default_trainer_id === t.id).map((m: any) => m.id),
        ...(allowedTrainers ?? []).filter((a: any) => a.trainer_id === t.id).map((a: any) => a.member_id),
      ])
      // Başarı: aylık completed / (completed+no_show) - basitçe hepsini completed say
      const successRate = totalRes > 0 ? 95 : 0 // placeholder, gerçek hesap için ayrı sorgu gerekir
      return { id: t.id, name: t.name, surname: t.surname, photo: t.profile_photo_url, bonusRate: t.bonus_rate ?? 0, dersMonth: totalRes, activeMembers: myMembers.size, primMonth: prim, successRate }
    }).filter((t: TrainerRow) => t.dersMonth > 0)
    setTrainers(trainerRows)

    // Bekleyen ödemeler (paketi yakında bitecek üyeler)
    const pendingRows: PendingMember[] = (endingSoon ?? []).map((ms: any) => {
      const member = Array.isArray(ms.members) ? ms.members[0] : ms.members
      const pt = Array.isArray(ms.payment_transactions) ? ms.payment_transactions[0] : ms.payment_transactions
      return {
        id: ms.member_id,
        name: member?.name ?? '',
        surname: member?.surname ?? '',
        photo: member?.profile_photo_url ?? null,
        packageName: `${ms.total_lessons} Ders Paketi`,
        endDate: ms.end_date,
        amount: pt?.amount ?? 0,
      }
    }).filter((p: PendingMember) => p.name)
    setPending(pendingRows)

    setLoading(false)
  }

  const pct = (today: number, yest: number) => {
    if (yest === 0) return today > 0 ? '+100%' : '—'
    const diff = ((today - yest) / yest * 100)
    return (diff >= 0 ? '+' : '') + Math.round(diff) + '%'
  }
  const pctColor = (today: number, yest: number) => today >= yest ? '#34d399' : '#f87171'

  // SVG Grafik
  const maxVal = Math.max(...chart.map(p => p.cumulative), 1)
  const W = 320; const H = 100
  const pts = chart.map(p => ({ x: ((p.day - 1) / (chart.length - 1 || 1)) * W, y: H - (p.cumulative / maxVal) * H }))
  const pathD = pts.length ? `M${pts.map(p => `${p.x},${p.y}`).join(' L')}` : ''
  const areaD = pts.length ? `${pathD} L${W},${H} L0,${H} Z` : ''

  const prevMonth = () => viewMonth.m === 0 ? setViewMonth({ y: viewMonth.y-1, m: 11 }) : setViewMonth({ y: viewMonth.y, m: viewMonth.m-1 })
  const nextMonth = () => viewMonth.m === 11 ? setViewMonth({ y: viewMonth.y+1, m: 0 }) : setViewMonth({ y: viewMonth.y, m: viewMonth.m+1 })

  if (loading) return <div className="flex items-center justify-center py-20"><p style={{ color: '#7b93c4' }}>Yükleniyor...</p></div>

  const CARD = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20 }

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-2xl font-bold text-white">Hesaplamalar</h1>

      {/* 4 Özet Kart */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'BUGÜNKÜ GELİR',     value: fmtTL(summary.gelirToday), today: summary.gelirToday, yest: summary.gelirYesterday, icon: '💰', color: '#34d399' },
          { label: 'İŞLENEN DERS',       value: String(summary.dersToday),  today: summary.dersToday,  yest: summary.dersYesterday,  icon: '📚', color: '#f59e0b' },
          { label: 'SATILAN PAKET',      value: String(summary.paketToday), today: summary.paketToday, yest: summary.paketYesterday, icon: '📦', color: '#38bdf8' },
          { label: 'BUGÜNKÜ PRİM',       value: fmtTL(summary.primToday),   today: summary.primToday,  yest: summary.primYesterday,  icon: '⭐', color: '#a78bfa' },
        ].map(card => (
          <div key={card.label} className="p-4" style={CARD}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>{card.icon}</div>
              <p className="text-[9px] font-bold tracking-widest" style={{ color: '#7b93c4' }}>{card.label}</p>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{card.value}</p>
            <p className="text-xs font-bold" style={{ color: pctColor(card.today, card.yest) }}>
              ↑ {pct(card.today, card.yest)} dünkü güne göre
            </p>
          </div>
        ))}
      </div>

      {/* Grafik */}
      <div className="p-4" style={CARD}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-white">Aylık Gelir Grafiği</p>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>‹</button>
            <p className="text-xs font-bold" style={{ color: '#7b93c4' }}>{MONTHS_TR[viewMonth.m]} {viewMonth.y}</p>
            <button onClick={nextMonth} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>›</button>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          {pathD && <path d={areaD} fill="url(#grad)" />}
          {pathD && <path d={pathD} fill="none" stroke="#34d399" strokeWidth="2" />}
          {pts.filter((_,i) => i % 5 === 0 || i === pts.length-1).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="#34d399" />
          ))}
        </svg>
        <div className="flex justify-between mt-1">
          <p className="text-[10px]" style={{ color: '#4a6190' }}>1 {MONTHS_S[viewMonth.m]}</p>
          <p className="text-[10px]" style={{ color: '#4a6190' }}>{new Date(viewMonth.y, viewMonth.m+1, 0).getDate()} {MONTHS_S[viewMonth.m]}</p>
        </div>
      </div>

      {/* Eğitmen Performansı */}
      {trainers.length > 0 && (
        <div className="p-4" style={CARD}>
          <p className="text-sm font-bold text-white mb-3">Eğitmen Performansı</p>
          <div className="space-y-3">
            {trainers.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(245,158,11,0.3)' }}>
                  {t.photo
                    ? <img src={t.photo} alt="" className="w-full h-full object-cover" />
                    : <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>{initials(t.name, t.surname)}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{t.name} {t.surname}</p>
                  <div className="flex gap-3 mt-1">
                    <div className="text-center">
                      <p className="text-sm font-bold" style={{ color: '#a78bfa' }}>{t.dersMonth}</p>
                      <p className="text-[9px]" style={{ color: '#4a6190' }}>Ders</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold" style={{ color: '#38bdf8' }}>{t.activeMembers}</p>
                      <p className="text-[9px]" style={{ color: '#4a6190' }}>Üye</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold" style={{ color: '#34d399' }}>{fmtTL(t.primMonth)}</p>
                      <p className="text-[9px]" style={{ color: '#4a6190' }}>Prim</p>
                    </div>
                  </div>
                </div>
                {/* Başarı dairesi */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <svg width="44" height="44" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    <circle cx="22" cy="22" r="18" fill="none" stroke="#34d399" strokeWidth="4"
                      strokeDasharray={`${(t.successRate / 100) * 113} 113`}
                      strokeLinecap="round" transform="rotate(-90 22 22)" />
                    <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">{t.successRate}%</text>
                  </svg>
                  <p className="text-[9px]" style={{ color: '#4a6190' }}>Başarı</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bekleyen Ödemeler */}
      {pending.length > 0 && (
        <div className="p-4" style={CARD}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">Paketi Bitecekler</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{pending.length}</span>
          </div>
          <div className="space-y-2">
            {pending.slice(0, 5).map(p => {
              const d = new Date(p.endDate + 'T00:00:00')
              const daysLeft = Math.ceil((d.getTime() - today.getTime()) / 86400000)
              const dot = daysLeft <= 7 ? '#f87171' : daysLeft <= 14 ? '#f59e0b' : '#34d399'
              return (
                <div key={p.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.08)' }}>
                    {p.photo
                      ? <img src={p.photo} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{initials(p.name, p.surname)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{p.name} {p.surname}</p>
                    <p className="text-xs" style={{ color: '#7b93c4' }}>{p.packageName} · {daysLeft} gün kaldı</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detaylı Tablo Aç/Kapat */}
      <button onClick={() => setShowDetail(p => !p)}
        className="w-full p-4 flex items-center justify-between rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">🧮</span>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Detaylı Hesaplamalar</p>
            <p className="text-xs" style={{ color: '#7b93c4' }}>Gelir, paket, ders ve eğitmen detayları</p>
          </div>
        </div>
        <span style={{ color: '#7b93c4' }}>{showDetail ? '↑' : '→'}</span>
      </button>

      {showDetail && <DetailTable />}
    </div>
  )
}

function DetailTable() {
  const today = new Date()
  const [day, setDay]     = useState(new Date(today))
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [data, setData]   = useState<any>(null)

  const MONTHS_S2 = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
  const DAYS_TR2  = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt']

  useEffect(() => { loadDetail() }, [day, month])

  const loadDetail = async () => {
    const supabase   = createClient()
    const dayStr     = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`
    const monthStart = `${month.y}-${String(month.m+1).padStart(2,'0')}-01`
    const monthEnd   = toDateStr(new Date(month.y, month.m+1, 1))

    const [{ data: ptAll }, { data: ptDay }, { data: ptMonth }, { data: resAll }, { data: resDay }, { data: resMonth }, { data: msAll }, { data: msDay }, { data: msMonth }, { data: trainers }] = await Promise.all([
      supabase.from('payment_transactions').select('amount').is('deleted_at', null),
      supabase.from('payment_transactions').select('amount').is('deleted_at', null).eq('payment_date', dayStr),
      supabase.from('payment_transactions').select('amount').is('deleted_at', null).gte('payment_date', monthStart).lt('payment_date', monthEnd),
      supabase.from('reservations').select('trainer_id, trainers(name,surname)').in('status', ['completed','no_show']),
      supabase.from('reservations').select('trainer_id, trainers(name,surname)').in('status', ['completed','no_show']).eq('scheduled_date', dayStr),
      supabase.from('reservations').select('trainer_id, trainers(name,surname)').in('status', ['completed','no_show']).gte('scheduled_date', monthStart).lt('scheduled_date', monthEnd),
      supabase.from('memberships').select('total_lessons, start_date'),
      supabase.from('memberships').select('total_lessons').eq('start_date', dayStr),
      supabase.from('memberships').select('total_lessons').gte('start_date', monthStart).lt('start_date', monthEnd),
      supabase.from('trainers').select('id, name, surname, bonus_rate').is('deleted_at', null).order('name'),
    ])

    const gelirAll = (ptAll??[]).reduce((s:number,p:any)=>s+(p.amount??0),0)
    const gelirDay = (ptDay??[]).reduce((s:number,p:any)=>s+(p.amount??0),0)
    const gelirMonth = (ptMonth??[]).reduce((s:number,p:any)=>s+(p.amount??0),0)
    const trainerRows = (trainers??[]).map((t:any) => ({
      id: t.id, name: `${t.name} ${t.surname}`,
      dersAll: (resAll??[]).filter((r:any)=>r.trainer_id===t.id).length,
      dersDay: (resDay??[]).filter((r:any)=>r.trainer_id===t.id).length,
      dersMonth: (resMonth??[]).filter((r:any)=>r.trainer_id===t.id).length,
    })).filter((t:any)=>t.dersAll>0)

    setData({
      gelirAll, gelirDay, gelirMonth,
      dersAll: (resAll??[]).length, dersDay: (resDay??[]).length, dersMonth: (resMonth??[]).length,
      paketAll: (msAll??[]).length, paketDay: (msDay??[]).length, paketMonth: (msMonth??[]).length,
      satisAll: (msAll??[]).reduce((s:number,m:any)=>s+(m.total_lessons??0),0),
      satisDay: (msDay??[]).reduce((s:number,m:any)=>s+(m.total_lessons??0),0),
      satisMonth: (msMonth??[]).reduce((s:number,m:any)=>s+(m.total_lessons??0),0),
      trainerRows,
    })
  }

  function toDateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  function fmt(n: number, money?: boolean) { return money ? new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.round(n)) : String(n) }

  const HDR = { color: '#7b93c4', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }
  const ROW = { borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const dayLabel = `${day.getDate()} ${MONTHS_S2[day.getMonth()]} ${DAYS_TR2[day.getDay()]}`
  const monthLabel = `${MONTHS_S2[month.m]} ${month.y}`

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="grid px-4 py-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={HDR}>Bilgi</p>
        <div className="flex items-center gap-1">
          <button onClick={() => { const d = new Date(day); d.setDate(d.getDate()-1); setDay(d) }} className="text-xs px-1 rounded" style={{ color:'#7b93c4',background:'rgba(255,255,255,0.06)'}}>‹</button>
          <p style={{ ...HDR, fontSize: 8 }}>{dayLabel}</p>
          <button onClick={() => { const d = new Date(day); d.setDate(d.getDate()+1); setDay(d) }} className="text-xs px-1 rounded" style={{ color:'#7b93c4',background:'rgba(255,255,255,0.06)'}}>›</button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => month.m===0?setMonth({y:month.y-1,m:11}):setMonth({y:month.y,m:month.m-1})} className="text-xs px-1 rounded" style={{ color:'#7b93c4',background:'rgba(255,255,255,0.06)'}}>‹</button>
          <p style={{ ...HDR, fontSize: 8 }}>{monthLabel}</p>
          <button onClick={() => month.m===11?setMonth({y:month.y+1,m:0}):setMonth({y:month.y,m:month.m+1})} className="text-xs px-1 rounded" style={{ color:'#7b93c4',background:'rgba(255,255,255,0.06)'}}>›</button>
        </div>
        <p style={HDR}>Toplam</p>
      </div>

      {!data ? <p className="text-center py-6 text-xs" style={{color:'#7b93c4'}}>Yükleniyor...</p> : <>
        {[
          { label: 'Gelir', day: data.gelirDay, month: data.gelirMonth, all: data.gelirAll, color: '#34d399', money: true },
          { label: 'Satılan Paket', day: data.paketDay, month: data.paketMonth, all: data.paketAll, color: '#38bdf8', money: false },
          { label: 'Satılan Ders', day: data.satisDay, month: data.satisMonth, all: data.satisAll, color: '#a78bfa', money: false },
          { label: 'İşlenen Ders', day: data.dersDay, month: data.dersMonth, all: data.dersAll, color: '#f59e0b', money: false },
        ].map(row => (
          <div key={row.label} className="grid px-4 py-2.5 items-center" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', ...ROW }}>
            <p className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{row.label}</p>
            <p className="text-xs font-bold" style={{ color: row.color }}>{fmt(row.day, row.money)}</p>
            <p className="text-xs font-bold" style={{ color: row.color }}>{fmt(row.month, row.money)}</p>
            <p className="text-xs font-bold" style={{ color: row.color }}>{fmt(row.all, row.money)}</p>
          </div>
        ))}
        {data.trainerRows.length > 0 && <>
          <div className="px-4 py-2" style={{ background: 'rgba(167,139,250,0.06)', borderTop: '1px solid rgba(167,139,250,0.1)' }}>
            <p style={{ ...HDR, color: '#a78bfa' }}>Eğitmen Dersleri</p>
          </div>
          {data.trainerRows.map((t: any) => (
            <div key={t.id} className="grid px-4 py-2.5 items-center" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', ...ROW }}>
              <p className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{t.name}</p>
              <p className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{t.dersDay}</p>
              <p className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{t.dersMonth}</p>
              <p className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{t.dersAll}</p>
            </div>
          ))}
        </>}
      </>}
    </div>
  )
}
