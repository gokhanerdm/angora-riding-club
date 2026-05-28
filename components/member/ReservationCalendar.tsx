'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TimeSlot {
  trainer_id: string
  trainer_name: string
  slot_time: string
  is_available: boolean
}

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function MonthCalendar({ year, month, selectedDate, onSelect }: {
  year: number
  month: number
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7

  const days: (number | null)[] = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let i = 1; i <= lastDay.getDate(); i++) days.push(i)

  return (
    <div className="flex-1 min-w-[200px]">
      <div className="text-center font-bold text-gray-900 mb-3">
        {MONTHS[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-bold text-gray-900">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={i} />
          const date = new Date(year, month, day)
          const dateStr = toDateStr(date)
          const isPast = date < today
          const isSelected = dateStr === selectedDate

          return (
            <button
              key={i}
              disabled={isPast}
              onClick={() => onSelect(dateStr)}
              className={`text-sm p-1 rounded font-medium ${
                isSelected
                  ? 'bg-gray-900 text-white font-bold'
                  : isPast
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-900 hover:bg-gray-100'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ReservationCalendar() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const months = []
  for (let i = 0; i < 4; i++) {
    const totalMonth = today.getMonth() + i
    const m = totalMonth % 12
    const y = today.getFullYear() + Math.floor(totalMonth / 12)
    months.push({ month: m, year: y })
  }

  const handleSelect = async (dateStr: string) => {
    setSelectedDate(dateStr)
    setModalOpen(true)
    setLoading(true)
    setSlots([])

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase.rpc('get_available_slots', {
      user_id: user.id,
      selected_date: dateStr
    })

    if (error) {
      console.error('Slots error:', error)
    } else {
      setSlots(data || [])
    }
    setLoading(false)
  }

  const handleReservation = async (slot: TimeSlot) => {
    if (!confirm(`${slot.slot_time.substring(0, 5)} saatinde rezervasyon yapmak istiyor musunuz?`)) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const endTime = new Date(`2000-01-01T${slot.slot_time}`)
    endTime.setMinutes(endTime.getMinutes() + 30)
    const endTimeStr = endTime.toTimeString().substring(0, 8)

    const { error } = await supabase.rpc('create_reservation', {
      user_id: user.id,
      p_trainer_id: slot.trainer_id,
      p_scheduled_date: selectedDate,
      p_start_time: slot.slot_time,
      p_end_time: endTimeStr,
      p_reservation_type: 'general'
    })

    if (error) {
      alert('Rezervasyon yapılamadı: ' + error.message)
    } else {
      alert('Rezervasyon başarılı!')
      setModalOpen(false)
    }
  }

  return (
    <div>
      <p className="font-bold text-gray-900 mb-4">Tarih Seçin</p>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {months.map(({ month, year }) => (
          <MonthCalendar
            key={`${year}-${month}`}
            year={year}
            month={month}
            selectedDate={selectedDate}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {selectedDate && (() => {
                  const [y, m, d] = selectedDate.split('-')
                  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`
                })()}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-900 font-bold text-2xl hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {loading && <p className="text-gray-900 font-bold text-center py-8">Yükleniyor...</p>}

            {!loading && slots.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {slots.map((slot, index) => (
                  <button
                    key={index}
                    disabled={!slot.is_available}
                    onClick={() => handleReservation(slot)}
                    className={`p-3 rounded-lg border text-sm font-bold ${
                      slot.is_available
                        ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                        : 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {slot.slot_time.substring(0, 5)}
                  </button>
                ))}
              </div>
            )}

            {!loading && slots.length === 0 && (
              <p className="text-gray-900 font-bold text-center py-8">Bu tarihte müsait ders bulunamadı.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}