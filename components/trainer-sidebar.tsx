"use client";

import Link from "next/link";
import { useState } from "react";
import LogoutButton from "@/components/logout-button";

const navItems = [] as const;

export default function TrainerSidebar({
  name,
  surname,
}: {
  name: string;
  surname: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-gray-800 p-3 text-white md:hidden"
        aria-label={isOpen ? "Menüyü kapat" : "Menüyü aç"}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed z-40 min-h-screen w-64 transform bg-gray-800 p-6 transition-transform duration-200 md:static ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        
        <nav className="mt-8 space-y-2">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className="block rounded px-4 py-2 text-gray-300 hover:bg-gray-700"
            >
              {label}
            </Link>
          ))}
        </nav>

        <LogoutButton />
      </aside>
    </>
  );
}
