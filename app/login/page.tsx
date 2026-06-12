"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const BG = "#FBFBFB";
const GREEN = "#1B3B2F";
const GREEN_SOFT = "#E8F0EA";
const MUTED = "#6B7280";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
  }

  // Şifremi unuttum
  const [forgotOpen, setForgotOpen]     = useState(false);
  const [resetEmail, setResetEmail]     = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg]         = useState("");
  const [resetErr, setResetErr]         = useState("");

  const router    = useRouter();
  const supabase  = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Giriş başarısız. Email veya şifre hatalı.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role === "admin")   router.push("/admin");
      else if (profile?.role === "trainer") router.push("/trainer");
      else router.push("/member");
      router.refresh();
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetErr("");
    setResetMsg("");

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    setResetLoading(false);
    if (error) setResetErr("Gönderilemedi. Email adresini kontrol et.");
    else {
      setResetMsg("Şifre sıfırlama linki emailine gönderildi.");
      setResetEmail("");
    }
  };

  const inputStyle = {
    background: GREEN_SOFT,
    border: "1px solid rgba(27,59,47,0.10)",
    color: GREEN,
  };

  return (
    <div
      className="flex items-center justify-center p-4"
      style={{ minHeight: '100dvh', background: BG }}
    >
      <div className="w-full max-w-sm">

        {/* Geri dön */}
        <Link href="/" className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-4"
          style={{ background: GREEN_SOFT, color: GREEN }}>
          ←
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: GREEN }}>Angora</h1>
          <p className="text-sm mt-1 font-bold" style={{ color: "#f59e0b" }}>
            Binicilik Spor Kulübü
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: MUTED }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              onFocus={handleFocus}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: MUTED }}>Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              onFocus={handleFocus}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={inputStyle}
            />
          </div>

          {/* Oturumu açık tut */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-amber-400"
            />
            <span className="text-xs" style={{ color: MUTED }}>Oturumumu açık tut</span>
          </label>

          {/* Şifremi unuttum */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => { setForgotOpen(true); setResetEmail(email); }}
              className="text-xs font-bold"
              style={{ color: MUTED }}
            >
              Şifremi Unuttum
            </button>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-2xl text-sm"
              style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
            style={{ background: "#f59e0b", color: GREEN }}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: MUTED }}>
          Hesabınız yok mu?{" "}
          <Link href="/signup" className="font-bold" style={{ color: "#f59e0b" }}>Kayıt Ol</Link>
        </p>
      </div>

      {/* Şifremi Unuttum Modalı */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: "#fff", border: "1px solid rgba(27,59,47,0.10)" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: GREEN_SOFT }} />
            <h3 className="text-lg font-bold mb-2" style={{ color: GREEN }}>Şifremi Unuttum</h3>
            <p className="text-sm mb-5" style={{ color: MUTED }}>
              Email adresini gir, şifre sıfırlama linki gönderelim.
            </p>

            {resetMsg ? (
              <div className="px-4 py-3 rounded-2xl text-sm mb-4"
                style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                {resetMsg}
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Email adresin"
                  required
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                  style={inputStyle}
                />
                {resetErr && (
                  <p className="text-xs" style={{ color: "#f87171" }}>{resetErr}</p>
                )}
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                  style={{ background: "#f59e0b", color: GREEN }}
                >
                  {resetLoading ? "Gönderiliyor..." : "Link Gönder"}
                </button>
              </form>
            )}

            <button
              onClick={() => { setForgotOpen(false); setResetMsg(""); setResetErr(""); }}
              className="w-full mt-3 py-2 text-sm font-bold rounded-2xl"
              style={{ background: GREEN_SOFT, color: MUTED }}
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
