import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      // next parametresi yoksa role'e göre yönlendir
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profile?.role === "admin")   return NextResponse.redirect(`${origin}/admin`);
        if (profile?.role === "trainer") return NextResponse.redirect(`${origin}/trainer`);
      }
      return NextResponse.redirect(`${origin}/member`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
