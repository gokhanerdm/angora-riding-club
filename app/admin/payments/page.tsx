'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
const DS = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt']

function ds(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmt(n: number, money?: boolean) {
  return money
    ? new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.round(n))
    : String(n)
}

export default function PaymentsPage() {
  const today = new Date()
  const [day,   setDay]   = useState(new Date(today))
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [data,  setData]  = useState<any>(null)

  useEffect(() => { load() }, [day, month])

  const load = async () => {
    const supabase   = createClient()
    const dayStr     = ds(day)
    const monthStart = `${month.y}-${String(month.m+1).padStart(2,'0')}-01`
    const monthEnd   = ds(new Date(month.y, month.m+1, 1))

    const [
      { data: msDay }, { data: msMonth }, { data: msAll },
      { data: resDay }, { data: resMonth }, { data: resAll },
      { data: trainers },
    ] = await Promise.all([
      supabase.from('memberships').select('total_lessons, payment_transactions(amount)').eq('start_date', dayStr),
      supabase.from('memberships').select('total_lessons, payment_transactions(amount)').gte('start_date', monthStart).lt('start_date', monthEnd),
      supabase.from('memberships').select('total_lessons, payment_transactions(amount)'),
      supabase.from('reservations').select('trainer_id').in('status',['completed','no_show']).eq('scheduled_date', dayStr),
      supabase.from('reservations').select('trainer_id').in('status',['completed','no_show']).gte('scheduled_date', monthStart).lt('scheduled_date', monthEnd),
      supabase.from('reservations').select('trainer_id').in('status',['completed','no_show']),
      supabase.from('trainers').select('id, name, surname').is('deleted_at', null).order('name'),
    ])

    const gelir = (rows: any[]) => (rows ?? []).reduce((s: number, ms: any) => {
      const pts = Array.isArray(ms.payment_transactions) ? ms.payment_transactions : (ms.payment_transactions ? [ms.payment_transactions] : [])
      return s + pts.reduce((s2: number, pt: any) => s2 + (pt?.amount ?? 0), 0)
    }, 0)

    const trainerRows = (trainers ?? []).map((t: any) => ({
      id: t.id,
      name: `${t.name} ${t.surname}`,
      day:   (resDay   ?? []).filter((r: any) => r.trainer_id === t.id).length,
      month: (resMonth ?? []).filter((r: any) => r.trainer_id === t.id).length,
      all:   (resAll   ?? []).filter((r: any) => r.trainer_id === t.id).length,
    }))
    const ORDER = ['Ömer Faruk', 'İrem', 'Melike']
    trainerRows.sort((a: any, b: any) => {
      const ai = ORDER.findIndex(n => a.name.includes(n))
      const bi = ORDER.findIndex(n => b.name.includes(n))
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

    setData({
      rows: [
        { label: 'Gelir',         color: '#34d399', money: true,  day: gelir(msDay??[]), month: gelir(msMonth??[]), all: gelir(msAll??[]) },
        { label: 'Satılan Paket', color: '#38bdf8', money: false, day: (msDay??[]).length, month: (msMonth??[]).length, all: (msAll??[]).length },
        { label: 'Satılan Ders',  color: '#a78bfa', money: false,
          day:   (msDay??[]).reduce((s:number,m:any)=>s+(m.total_lessons??0),0),
          month: (msMonth??[]).reduce((s:number,m:any)=>s+(m.total_lessons??0),0),
          all:   (msAll??[]).reduce((s:number,m:any)=>s+(m.total_lessons??0),0),
        },
        { label: 'İşlenen Ders',  color: '#f59e0b', money: false, day: (resDay??[]).length, month: (resMonth??[]).length, all: (resAll??[]).length },
      ],
      trainerRows,
    })
  }

  const dayLabel   = `${day.getDate()} ${MS[day.getMonth()]} ${DS[day.getDay()]}`
  const monthLabel = `${MS[month.m]} ${month.y}`
  const HDR = { color: '#7b93c4', fontSize: 9, fontWeight: 700, letterSpacing: 1 }
  const COL = 'flex flex-col items-center justify-center text-center'

  const Nav = ({ onPrev, onNext, label, sub }: { onPrev:()=>void; onNext:()=>void; label:string; sub:string }) => (
    <div className="flex items-center justify-center gap-1.5 py-3 px-1" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
      <button onClick={onPrev} className="w-5 h-5 flex items-center justify-center rounded text-xs flex-shrink-0" style={{ color:'#7b93c4', background:'rgba(255,255,255,0.08)' }}>‹</button>
      <div className={COL}>
        <p style={{ ...HDR, color: sub === 'BUGÜN' ? '#f59e0b' : sub === 'BU AY' ? '#38bdf8' : '#a78bfa', fontSize: 8 }}>{sub}</p>
        <p className="text-[9px] font-bold text-white">{label}</p>
      </div>
      <button onClick={onNext} className="w-5 h-5 flex items-center justify-center rounded text-xs flex-shrink-0" style={{ color:'#7b93c4', background:'rgba(255,255,255,0.08)' }}>›</button>
    </div>
  )

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-2xl font-bold text-white">Hesaplamalar</h1>

      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Başlık */}
        <div className="grid" style={{ gridTemplateColumns: '2fr 3fr 3fr 3fr', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          <div className="px-3 py-3" />
          <Nav
            sub="BUGÜN" label={dayLabel}
            onPrev={() => { const d = new Date(day); d.setDate(d.getDate()-1); setDay(d) }}
            onNext={() => { const d = new Date(day); d.setDate(d.getDate()+1); setDay(d) }}
          />
          <Nav
            sub="BU AY" label={monthLabel}
            onPrev={() => month.m===0?setMonth({y:month.y-1,m:11}):setMonth({y:month.y,m:month.m-1})}
            onNext={() => month.m===11?setMonth({y:month.y+1,m:0}):setMonth({y:month.y,m:month.m+1})}
          />
          <div className={`${COL} py-3`} style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ ...HDR, color: '#a78bfa', fontSize: 8 }}>TOPLAM</p>
            <p className="text-[9px] font-bold text-white">Tüm Zaman</p>
          </div>
        </div>

        {/* Satırlar */}
        {!data ? (
          <p className="text-center py-10 text-xs" style={{ color: '#7b93c4' }}>Yükleniyor...</p>
        ) : (
          <>
            {data.rows.map((row: any) => (
              <div key={row.label} className="grid items-center" style={{ gridTemplateColumns: '2fr 3fr 3fr 3fr', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="px-3 py-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                  <span className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{row.label}</span>
                </div>
                <p className="text-center text-sm font-bold py-4" style={{ color: row.color, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{fmt(row.day, row.money)}</p>
                <p className="text-center text-sm font-bold py-4" style={{ color: row.color, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{fmt(row.month, row.money)}</p>
                <p className="text-center text-sm font-bold py-4" style={{ color: row.color, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{fmt(row.all, row.money)}</p>
              </div>
            ))}

            {data.trainerRows.length > 0 && (
              <>
                <div className="px-3 py-2" style={{ background: 'rgba(167,139,250,0.05)', borderTop: '1px solid rgba(167,139,250,0.12)' }}>
                  <p style={{ ...HDR, color: '#a78bfa' }}>EĞİTMEN DERSLERİ</p>
                </div>
                {data.trainerRows.map((t: any) => (
                  <div key={t.id} className="grid items-center" style={{ gridTemplateColumns: '2fr 3fr 3fr 3fr', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="px-3 py-3">
                      <p className="text-xs font-bold" style={{ color: '#c8d6f0' }}>{t.name}</p>
                    </div>
                    <p className="text-center text-sm font-bold py-3" style={{ color: '#c8d6f0', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{t.day}</p>
                    <p className="text-center text-sm font-bold py-3" style={{ color: '#c8d6f0', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{t.month}</p>
                    <p className="text-center text-sm font-bold py-3" style={{ color: '#c8d6f0', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{t.all}</p>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
