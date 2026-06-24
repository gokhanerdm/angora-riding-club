'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/member',          label: 'Anasayfa',  icon: '🏠', exact: true },
  { href: '/member/packages', label: 'Paketlerim', icon: '📦' },
  { href: '/member/profile-edit', label: 'Profil', icon: '👤' },
]

export default function MemberBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: '#FBFBFB',
        borderTop: '1px solid rgba(27,59,47,0.10)',
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
            style={{ color: active ? '#1B3B2F' : 'rgba(27,59,47,0.35)' }}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[9px] font-bold tracking-wide">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
