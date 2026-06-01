"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={className ?? "mt-8 w-full rounded bg-red-600 px-4 py-2 text-white transition hover:bg-red-700 disabled:opacity-50"}
    >
      {loading ? "Çıkış yapılıyor..." : "Çıkış Yap"}
    </button>
  );
}
