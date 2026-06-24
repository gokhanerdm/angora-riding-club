'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',               label: 'Anasayfa',   icon: '🏠', exact: true },
  { href: '/admin/trainers',      label: 'Eğitmenler', icon: '🏇' },
  { href: '/admin/members',       label: 'Üyeler',     icon: '👥' },
  { href: '/admin/memberships',   label: 'Üyelikler',  icon: '📋' },
  { href: '/admin/payments',      label: 'Hesaplar',   icon: '💰' },
  { href: '/admin/notifications', label: 'İstekler',   icon: '🔔' },
]

export default function AdminBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: '#070d26',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        height: 64,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV.map(item => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-opacity active:opacity-60"
            style={{ color: active ? '#f59e0b' : '#4a6190' }}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[9px] font-bold tracking-wide">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
