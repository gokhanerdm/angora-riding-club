import { createClient } from '@/lib/supabase/server'

interface AdminStats {
  total_members: number
  active_memberships: number
  pending_reservations: number
  total_sales: number
  total_collected: number
  remaining_debt: number
}
async function getAdminStats(): Promise<AdminStats | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    
    const { data, error } = await supabase.rpc('admin_dashboard_stats', {
      user_id: user.id
    })
    
    if (error) {
      console.error('Admin stats error:', error)
      return null
    }
    
    return data as AdminStats
  } catch (error) {
    console.error('Stats fetch error:', error)
    return null
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default async function AdminDashboard() {
  const stats = await getAdminStats()
  
  const statCards = [
    { label: 'Toplam Üye', value: stats?.total_members ?? 0, icon: '👥', status: stats ? 'active' : 'unavailable' },
    { label: 'Aktif Üyelik', value: stats?.active_memberships ?? 0, icon: '💳', status: stats ? 'active' : 'unavailable' },
    { label: 'Bekleyen Rezervasyon', value: stats?.pending_reservations ?? 0, icon: '📅', status: stats ? 'active' : 'unavailable' },
    { label: 'Toplam Satış', value: stats?.total_sales ?? 0, icon: '💰', status: stats ? 'active' : 'unavailable', isCurrency: true },
    { label: 'Tahsil Edilen', value: stats?.total_collected ?? 0, icon: '✅', status: stats ? 'active' : 'unavailable', isCurrency: true },
    { label: 'Kalan Borç', value: stats?.remaining_debt ?? 0, icon: '⏳', status: stats ? 'active' : 'unavailable', isCurrency: true }
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Kontrol Paneli</h1>
        <p className="text-gray-600 mt-1">Genel bakış ve istatistikler</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl">{card.icon}</div>
              {card.status === 'unavailable' && (
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">Veri yok</span>
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {card.isCurrency ? formatCurrency(card.value) : card.value.toLocaleString('tr-TR')}
            </div>
            <div className="text-sm text-gray-600">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}