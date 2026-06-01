"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

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
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#c8d6f0",
  };

  return (
    <div
      className="min-h-screen flex items-end justify-center p-4 pb-40"
      style={{ background: "linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)" }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Angora</h1>
          <p className="text-sm mt-1 font-bold" style={{ color: "#f59e0b" }}>
            Binicilik Spor Kulübü
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: "#7b93c4" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: "#7b93c4" }}>Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={inputStyle}
            />
          </div>

          {/* Şifremi unuttum */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => { setForgotOpen(true); setResetEmail(email); }}
              className="text-xs font-bold"
              style={{ color: "#7b93c4" }}
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
            style={{ background: "#f59e0b", color: "#0a0f2e" }}
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "#4a6190" }}>
          Hesabınız yok mu?{" "}
          <Link href="/signup" className="font-bold" style={{ color: "#f59e0b" }}>Kayıt Ol</Link>
        </p>
      </div>

      {/* Şifremi Unuttum Modalı */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="w-full rounded-t-3xl p-6" style={{ background: "#0d1b4b", border: "1px solid rgba(255,255,255,0.10)" }}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "rgba(255,255,255,0.15)" }} />
            <h3 className="text-lg font-bold text-white mb-2">Şifremi Unuttum</h3>
            <p className="text-sm mb-5" style={{ color: "#7b93c4" }}>
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
                  style={{ background: "#f59e0b", color: "#0a0f2e" }}
                >
                  {resetLoading ? "Gönderiliyor..." : "Link Gönder"}
                </button>
              </form>
            )}

            <button
              onClick={() => { setForgotOpen(false); setResetMsg(""); setResetErr(""); }}
              className="w-full mt-3 py-2 text-sm font-bold rounded-2xl"
              style={{ background: "rgba(255,255,255,0.06)", color: "#7b93c4" }}
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
