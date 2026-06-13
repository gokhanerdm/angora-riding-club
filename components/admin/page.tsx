'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const menuItems = [
    { href: '/admin', label: 'Kontrol Paneli', icon: '📊' },
    { href: '/admin/members', label: 'Üyeler', icon: '👥' },
    { href: '/admin/trainers', label: 'Eğitmenler', icon: '🏇' },
    { href: '/admin/memberships', label: 'Üyelikler', icon: '💳' },
    { href: '/admin/reservations', label: 'Rezervasyonlar', icon: '📅' },
    { href: '/admin/payments', label: 'Ödemeler', icon: '💰' },
    { href: '/admin/notifications', label: 'İstekler', icon: '🔔' },
    { href: '/admin/settings', label: 'Ayarlar', icon: '⚙️' },
  ]

  return (
    <>
      {/* Hamburger - Mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-gray-900 p-3 rounded-lg text-white"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static w-72 bg-gray-900 min-h-screen z-40 transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-2">Angora</h2>
          <p className="text-amber-500 text-sm">Admin Paneli</p>
        </div>

        <nav className="px-4">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 mb-1 rounded-lg transition
                ${pathname === item.href 
                  ? 'bg-amber-500 text-gray-900 font-semibold' 
                  : 'text-gray-300 hover:bg-gray-800'}
              `}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}