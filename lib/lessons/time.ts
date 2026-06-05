/**
 * Verilen tarih + saat kombinasyonu şu andan önce mi?
 * Tarayıcının yerel saatini kullanır — sabit +03:00 offset kullanmaz.
 */
export function isSlotPast(dateStr: string, slotTime: string): boolean {
  const slotDate = new Date(`${dateStr}T${slotTime.substring(0, 5)}:00`)
  return slotDate < new Date()
}

/**
 * Verilen tarih tamamen geçmiş mi? (gün sonu 23:59:59)
 */
export function isDatePast(dateStr: string): boolean {
  return new Date(`${dateStr}T23:59:59`) < new Date()
}
