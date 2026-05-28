import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
export { requireTrainer } from "./require-trainer";
export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (!profile || profile.role !== 'admin') redirect('/unauthorized')
  
  return { userId: user.id }
}
export async function requireMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'member' && profile.role !== 'admin')) {
    redirect('/unauthorized')
  }

  return user
}