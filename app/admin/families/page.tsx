'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const CARD  = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
const INPUT = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', color: '#c8d6f0' }

type Family = {
  id: string
  name: string
  members: { id: string; name: string; surname: string; is_leader: boolean }[]
  membership?: { id: string; total_lessons: number; used_lessons: number; reserved_lessons: number }
}

export default function FamiliesPage() {
  const router = useRouter()
  const [families, setFamilies]   = useState<Family[]>([])
  const [members,  setMembers]    = useState<any[]>([])
  const [memberships, setMemberships]       = useState<any[]>([])
  const [allMemberships, setAllMemberships] = useState<any[]>([])
  const [loading,  setLoading]    = useState(true)
  const [toast,    setToast]      = useState('')

  // Yeni aile modal
  const [creating,     setCreating]     = useState(false)
  const [newName,      setNewName]      = useState('')
  const [newLeader,    setNewLeader]    = useState('')
  const [saving,       setSaving]       = useState(false)

  // Üye ekle modal
  const [addModal,     setAddModal]     = useState<string | null>(null) // family_id
  const [addMember,    setAddMember]    = useState('')

  // Üyelik bağla modal
  const [msModal,      setMsModal]      = useState<string | null>(null)
  const [addMs,        setAddMs]        = useState('')

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }

  const load = async () => {
    setLoading(true)
    const supabase = createClient()

    const [{ data: fams }, { data: mems }, { data: ms }, { data: allMs }] = await Promise.all([
      supabase.from('families').select('id, name').order('name'),
      supabase.from('members').select('id, name, surname').is('deleted_at', null).order('name'),
      supabase.from('memberships').select('id, family_id, total_lessons, used_lessons, reserved_lessons, member_id').not('family_id', 'is', null),
      supabase.from('memberships').select('id, member_id, total_lessons, used_lessons, reserved_lessons').is('family_id', null).eq('is_current', true),
    ])

    const { data: fms } = await supabase
      .from('family_members')
      .select('family_id, member_id, is_leader, members(id, name, surname)')

    const familyList: Family[] = (fams ?? []).map(f => ({
      id: f.id,
      name: f.name,
      members: (fms ?? [])
        .filter(fm => fm.family_id === f.id)
        .map(fm => ({ id: (fm.members as any).id, name: (fm.members as any).name, surname: (fm.members as any).surname, is_leader: fm.is_leader })),
      membership: (ms ?? []).find(m => m.family_id === f.id),
    }))

    setFamilies(familyList)
    setMembers(mems ?? [])
    setMemberships((ms ?? []))
    setAllMemberships(allMs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName || !newLeader) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('create_family_group', {
      p_admin_id: user.id, p_name: newName, p_leader_id: newLeader
    })
    setSaving(false)
    if (error) { showToast('Hata: ' + error.message); return }
    showToast('Aile grubu oluşturuldu ✓')
    setCreating(false); setNewName(''); setNewLeader('')
    load()
  }

  const handleAddMember = async () => {
    if (!addModal || !addMember) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('add_family_member', {
      p_admin_id: user.id, p_family_id: addModal, p_member_id: addMember
    })
    if (error) showToast('Hata: ' + error.message)
    else { showToast('Üye eklendi ✓'); setAddModal(null); setAddMember(''); load() }
  }

  const handleRemoveMember = async (familyId: string, memberId: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('remove_family_member', {
      p_admin_id: user.id, p_family_id: familyId, p_member_id: memberId
    })
    if (error) showToast('Hata: ' + error.message)
    else { showToast('Üye çıkarıldı ✓'); load() }
  }

  const handleAssignMs = async () => {
    if (!msModal || !addMs) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.rpc('assign_membership_to_family', {
      p_admin_id: user.id, p_membership_id: addMs, p_family_id: msModal
    })
    if (error) showToast('Hata: ' + error.message)
    else { showToast('Üyelik bağlandı ✓'); setMsModal(null); setAddMs(''); load() }
  }

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}>
      <p style={{ color: '#7b93c4' }}>Yükleniyor...</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(160deg, #0a0f2e, #0d1b4b, #071428)' }}>
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[120] px-5 py-3 rounded-2xl text-sm font-bold text-white whitespace-nowrap"
          style={{ background: toast.includes('✓') ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-4 sticky top-0 z-10"
        style={{ background: '#0a0f2e', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => router.back()} className="font-bold text-sm px-3 py-2 rounded-xl"
          style={{ color: '#7b93c4', background: 'rgba(255,255,255,0.06)' }}>← Geri</button>
        <div className="flex-1">
          <h2 className="font-bold text-white">Aile Grupları</h2>
          <p className="text-xs" style={{ color: '#7b93c4' }}>{families.length} grup</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
          + Yeni Grup
        </button>
      </div>

      <div className="px-4 py-5 space-y-4">
        {families.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: '#4a6190' }}>Henüz aile grubu yok</p>
        )}

        {families.map(f => {
          const remaining = f.membership
            ? f.membership.total_lessons - f.membership.used_lessons - f.membership.reserved_lessons
            : null
          return (
            <div key={f.id} className="rounded-2xl p-4 space-y-3" style={CARD}>
              {/* Başlık */}
              <div className="flex items-center justify-between">
                <p className="font-bold text-white">{f.name}</p>
                {remaining !== null && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                    {remaining} ders kaldı
                  </span>
                )}
              </div>

              {/* Üyelik */}
              {f.membership ? (
                <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                  <span style={{ color: '#a78bfa' }}>Paket: </span>
                  <span style={{ color: '#c8d6f0' }}>
                    {f.membership.total_lessons} ders · {f.membership.used_lessons} kullanıldı · {f.membership.reserved_lessons} rezerve
                  </span>
                </div>
              ) : (
                <button onClick={() => { setMsModal(f.id); setAddMs('') }}
                  className="w-full py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                  + Üyelik Bağla
                </button>
              )}

              {/* Bireyler */}
              <div className="space-y-1">
                {f.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: '#c8d6f0' }}>{m.name} {m.surname}</span>
                      {m.is_leader && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Ana Üye</span>
                      )}
                    </div>
                    {!m.is_leader && (
                      <button onClick={() => handleRemoveMember(f.id, m.id)}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)' }}>Çıkar</button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={() => { setAddModal(f.id); setAddMember('') }}
                className="w-full py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}>
                + Üye Ekle
              </button>
            </div>
          )
        })}
      </div>

      {/* Yeni Aile Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full rounded-t-3xl p-6 pb-32 space-y-4" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="font-bold text-white text-lg">Yeni Aile Grubu</h3>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Aile adı (örn. Yılmaz Ailesi)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT} />
            <div>
              <p className="text-xs mb-1 font-bold" style={{ color: '#7b93c4' }}>Ana Üye</p>
              <select value={newLeader} onChange={e => setNewLeader(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT}>
                <option value="">Üye seç...</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name} {m.surname}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCreating(false)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Vazgeç</button>
              <button onClick={handleCreate} disabled={saving || !newName || !newLeader}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0f2e' }}>
                {saving ? 'Kaydediliyor...' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Üye Ekle Modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full rounded-t-3xl p-6 pb-32 space-y-4" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="font-bold text-white text-lg">Aile Üyesi Ekle</h3>
            <select value={addMember} onChange={e => setAddMember(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT}>
              <option value="">Üye seç...</option>
              {members
                .filter(m => !families.find(f => f.id === addModal)?.members.find(fm => fm.id === m.id))
                .map(m => <option key={m.id} value={m.id}>{m.name} {m.surname}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setAddModal(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Vazgeç</button>
              <button onClick={handleAddMember} disabled={!addMember}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #34d399, #059669)', color: '#fff' }}>
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Üyelik Bağla Modal */}
      {msModal && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full rounded-t-3xl p-6 pb-32 space-y-4" style={{ background: '#0d1b4b', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 className="font-bold text-white text-lg">Üyelik Bağla</h3>
            <p className="text-xs" style={{ color: '#7b93c4' }}>Ana üyenin aktif üyeliğini seçin</p>
            <select value={addMs} onChange={e => setAddMs(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={INPUT}>
                      <option value="">Üyelik seç...</option>
              {allMemberships
                .filter(m => {
                  const fam = families.find(f => f.id === msModal)
                  const leader = fam?.members.find(mb => mb.is_leader)
                  return leader && m.member_id === leader.id
                })
                .map(m => (
                  <option key={m.id} value={m.id}>
                    {m.total_lessons} ders · {m.total_lessons - m.used_lessons - m.reserved_lessons} kaldı
                  </option>
                ))}
            </select>
            <p className="text-xs text-center" style={{ color: '#7b93c4' }}>
              Üyeliği önce üye profilinden aile paketi olarak onaylayın, ardından buradan bağlayın.
            </p>
            <button onClick={() => setMsModal(null)} className="w-full py-3 rounded-2xl font-bold text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#7b93c4' }}>Kapat</button>
          </div>
        </div>
      )}
    </div>
  )
}
