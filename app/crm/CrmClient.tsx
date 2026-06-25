'use client'

import { useState, useTransition } from 'react'
import { toggleTask, moveDeal, createContact, createDeal, createTask, addNote } from '@/app/actions/crm'

const AVATAR_COLORS = ['#157A60','#C08A3E','#4A7BA6','#7A5EA6','#B5563F','#3F7A6E']
const STAGES = [
  { name:'Lead', color:'#9A9A90' },
  { name:'Contactado', color:'#C08A3E' },
  { name:'Propuesta', color:'#4A7BA6' },
  { name:'Negociación', color:'#7A5EA6' },
  { name:'Ganado', color:'#157A60' },
]
const ACT_ICONS: Record<string,string> = {
  email:'M4 6h16v12H4zM4 7l8 6 8-6',
  call:'M5 4h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2',
  note:'M7 3h9l4 4v14H7zM15 3v5h5',
  meeting:'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
  deal:'M4 16l5-5 4 4 7-7M16 8h4v4',
}

const eur = (n: number) => '€' + Number(n).toLocaleString('es-ES')
const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
const statusColor = (s: string) => ({ Cliente:'#157A60', Oportunidad:'#C08A3E', Lead:'#4A7BA6', Inactivo:'#9A9A90' }[s] ?? '#9A9A90')
const statusBg = (s: string) => ({ Cliente:'#E6F0EB', Oportunidad:'#F6ECDD', Lead:'#E6EDF3', Inactivo:'#ECEAE4' }[s] ?? '#ECEAE4')
const avatarFor = (name: string, contacts: any[]) => {
  const i = contacts.findIndex((c:any) => c.name === name)
  return AVATAR_COLORS[(i < 0 ? 0 : i) % AVATAR_COLORS.length]
}

type View = 'dashboard' | 'contacts' | 'pipeline' | 'tasks'
type DetailTab = 'resumen' | 'actividad' | 'notas'

interface Props {
  initialData: { contacts: any[]; deals: any[]; tasks: any[]; activities: any[] }
}

export default function CrmClient({ initialData }: Props) {
  const [contacts, setContacts] = useState(initialData.contacts)
  const [deals, setDeals] = useState(initialData.deals)
  const [tasks, setTasks] = useState(initialData.tasks)
  const [activities] = useState(initialData.activities)

  const [view, setView] = useState<View>('dashboard')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('resumen')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [modal, setModal] = useState<'contact'|'deal'|'task'|null>(null)
  const [noteText, setNoteText] = useState('')
  const [, startTransition] = useTransition()
  let dragId: string | null = null

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  function handleToggleTask(id: number) {
    const t = tasks.find(t => t.id === id)
    if (!t) return
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t))
    startTransition(() => toggleTask(id, !t.done))
  }

  function handleDrop(stage: string, id: string) {
    setDeals(ds => ds.map(d => String(d.id) === id ? { ...d, stage } : d))
    startTransition(() => moveDeal(Number(id), stage))
  }

  // NAV
  const pendingToday = tasks.filter(t => t.today && !t.done).length
  const NAV = [
    { view:'dashboard', label:'Panel', icon:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
    { view:'contacts', label:'Contactos', icon:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { view:'pipeline', label:'Pipeline', icon:'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v7h-4z' },
    { view:'tasks', label:'Tareas', icon:'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2' },
  ]

  // CONTACTS
  const contactsView = contacts.map((c, i) => ({
    ...c,
    initials: initials(c.name),
    avatarBg: AVATAR_COLORS[i % AVATAR_COLORS.length],
    valueFmt: eur(c.value ?? 0),
    statusColor: statusColor(c.status),
    statusBg: statusBg(c.status),
    notesDisplay: c.notes?.trim() ? c.notes : 'Sin notas todavía.',
  }))
  const q = search.trim().toLowerCase()
  const filteredContacts = q ? contactsView.filter(c => (c.name+' '+c.company+' '+c.email).toLowerCase().includes(q)) : contactsView
  const selected = selectedId != null ? contactsView.find(c => c.id === selectedId) ?? null : null

  // DEALS
  const dealsFmt = deals.map(d => ({
    ...d,
    valueFmt: eur(d.value ?? 0),
    ownerInitials: initials(d.owner || 'U'),
    ownerBg: '#4A7BA6',
    stageColor: STAGES.find(s => s.name === d.stage)?.color ?? '#9A9A90',
  }))
  const columns = STAGES.map(s => {
    const ds = dealsFmt.filter(d => d.stage === s.name)
    return { ...s, deals: ds, count: ds.length, valueFmt: eur(ds.reduce((a:number, d:any) => a + (d.value??0), 0)) }
  })

  // DASHBOARD
  const openDeals = deals.filter(d => d.stage !== 'Ganado')
  const wonDeals = deals.filter(d => d.stage === 'Ganado')
  const stageTotals = STAGES.map(s => deals.filter(d => d.stage === s.name).reduce((a:number,d:any) => a+(d.value??0),0))
  const maxVal = Math.max(...stageTotals, 1)
  const funnel = STAGES.map((s,i) => ({
    ...s,
    valueFmt: eur(stageTotals[i]),
    count: deals.filter(d => d.stage === s.name).length,
    pct: Math.max(4, Math.round(stageTotals[i]/maxVal*100)),
  }))
  const metrics = [
    { label:'Valor en pipeline', value: eur(openDeals.reduce((a:number,d:any)=>a+(d.value??0),0)), delta:'+12%', deltaColor:'#157A60', deltaBg:'#E6F0EB', sub:'vs. mes anterior' },
    { label:'Negocios abiertos', value: String(openDeals.length), delta:'esta semana', deltaColor:'#4A7BA6', deltaBg:'#E6EDF3', sub:'abiertos' },
    { label:'Ganado este mes', value: eur(wonDeals.reduce((a:number,d:any)=>a+(d.value??0),0)), delta:'+8%', deltaColor:'#157A60', deltaBg:'#E6F0EB', sub:`${wonDeals.length} cerrados` },
    { label:'Tareas para hoy', value: String(pendingToday), delta: pendingToday ? 'pendientes' : 'al día', deltaColor:'#B8742A', deltaBg:'#F6ECDD', sub:'con vencimiento hoy' },
  ]

  // TASKS
  const tasksView = tasks.map(t => ({
    ...t,
    contactInitials: initials(t.contact_name || 'U'),
    contactBg: avatarFor(t.contact_name, contacts),
    checkBg: t.done ? '#157A60' : '#fff',
    checkBorder: t.done ? '#157A60' : '#CFCABF',
    checkOpacity: t.done ? 1 : 0,
    titleColor: t.done ? '#A9A79E' : '#1B1B18',
    titleDeco: t.done ? 'line-through' : 'none',
  }))
  const todayTasks = tasksView.filter(t => t.today)

  // ACTIVITIES
  const activitiesView = activities.map((a:any) => ({
    ...a,
    initials: initials(a.contact_name || 'U'),
    bg: avatarFor(a.contact_name, contacts),
    icon: ACT_ICONS[a.type] ?? ACT_ICONS.note,
    time: new Date(a.created_at).toLocaleDateString('es-ES', { day:'2-digit', month:'short' }),
  }))

  // DETAIL
  const detailDeals = selected ? dealsFmt.filter(d => d.company === selected.company) : []
  const detailActs = selected ? activitiesView.filter((a:any) => a.contact_name === selected.name) : []

  const tabStyle = (name: string) => ({
    color: detailTab === name ? '#1B1B18' : '#9A988F',
    borderBottom: `2px solid ${detailTab === name ? '#19191A' : 'transparent'}`,
  })

  const INPUT = "width:100%;border:1px solid #E2DDD2;border-radius:9px;padding:9px 12px;font-family:'IBM Plex Sans',sans-serif;font-size:13.5px;color:#1B1B18;outline:none;background:#fff"
  const LABEL = { fontSize:12, fontWeight:600, color:'#6B6A63', marginBottom:5, display:'block' as const, letterSpacing:'0.04em', textTransform:'uppercase' as const }

  // CREATE CONTACT FORM
  const [cf, setCf] = useState({ name:'', company:'', email:'', phone:'', status:'Lead', value:'', owner:'', notes:'' })
  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault()
    const res = await createContact({ ...cf, value: Number(cf.value)||0 })
    if (res && 'error' in res) { showToast('Error: ' + res.error); return }
    setModal(null)
    setCf({ name:'', company:'', email:'', phone:'', status:'Lead', value:'', owner:'', notes:'' })
    showToast('Contacto creado')
    window.location.reload()
  }

  // CREATE DEAL FORM
  const [df, setDf] = useState({ title:'', company:'', value:'', stage:'Lead', owner:'' })
  async function handleCreateDeal(e: React.FormEvent) {
    e.preventDefault()
    const res = await createDeal({ ...df, value: Number(df.value)||0 })
    if (res && 'error' in res) { showToast('Error: ' + res.error); return }
    setModal(null)
    setDf({ title:'', company:'', value:'', stage:'Lead', owner:'' })
    showToast('Negocio creado')
    window.location.reload()
  }

  // CREATE TASK FORM
  const [tf, setTf] = useState({ title:'', due:'', contact_name:'', today: false })
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    const res = await createTask(tf)
    if (res && 'error' in res) { showToast('Error: ' + res.error); return }
    setModal(null)
    setTf({ title:'', due:'', contact_name:'', today: false })
    showToast('Tarea creada')
    window.location.reload()
  }

  async function handleSaveNote() {
    if (!selected || !noteText.trim()) return
    await addNote(selected.id, selected.name, noteText)
    setNoteText('')
    showToast('Nota guardada')
    window.location.reload()
  }

  const newButtonLabel = { dashboard:'Nuevo', contacts:'Nuevo contacto', pipeline:'Nuevo negocio', tasks:'Nueva tarea' }[view]
  function handleNew() {
    if (view === 'contacts') setModal('contact')
    else if (view === 'pipeline') setModal('deal')
    else if (view === 'tasks') setModal('task')
    else setModal('contact')
  }

  return (
    <div style={{ display:'flex', height:'100vh', width:'100%', background:'#F4F2EC', color:'#1B1B18', fontFamily:"'IBM Plex Sans',sans-serif", fontSize:14, overflow:'hidden' }}>

      {/* SIDEBAR */}
      <aside style={{ width:236, flexShrink:0, background:'#19191A', display:'flex', flexDirection:'column', padding:'22px 16px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:11, padding:'4px 8px 24px' }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'#157A60', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.4"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M5 5l2.4 2.4M16.6 16.6L19 19M19 5l-2.4 2.4M7.4 16.6L5 19"/></svg>
          </div>
          <div>
            <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontWeight:700, fontSize:17, color:'#FAF9F6', letterSpacing:'-0.01em' }}>Núcleo</div>
            <div style={{ fontSize:10.5, color:'#75736C', letterSpacing:'0.14em', textTransform:'uppercase', marginTop:1 }}>CRM</div>
          </div>
        </div>

        <div style={{ fontSize:10.5, color:'#5E5C56', letterSpacing:'0.12em', textTransform:'uppercase', padding:'0 10px 8px' }}>Menú</div>
        <nav style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {NAV.map(item => (
            <button key={item.view} onClick={() => setView(item.view as View)} style={{
              display:'flex', alignItems:'center', gap:11, padding:'9px 11px', borderRadius:9,
              cursor:'pointer', background: item.view===view ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: item.view===view ? '#FAF9F6' : '#A8A69E', fontSize:14, fontWeight:500,
              textDecoration:'none', border:'none', fontFamily:'inherit', transition:'background .15s', textAlign:'left',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
              <span style={{ flex:1 }}>{item.label}</span>
              {item.view==='tasks' && pendingToday > 0 && (
                <span style={{ fontSize:11, fontWeight:600, color:'#FAF9F6', background:'#157A60', borderRadius:999, padding:'1px 7px' }}>{pendingToday}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ marginTop:'auto', paddingTop:16, borderTop:'1px solid #2A2A2A', display:'flex', alignItems:'center', gap:11 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:'#4A7BA6', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:13, flexShrink:0 }}>GB</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, color:'#E7E5DE', fontWeight:500 }}>GestionBar</div>
            <div style={{ fontSize:11.5, color:'#75736C' }}>Administrador</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, position:'relative' }}>
        {/* HEADER */}
        <header style={{ display:'flex', alignItems:'center', gap:18, padding:'18px 28px', borderBottom:'1px solid #E6E1D7', flexShrink:0, background:'#F4F2EC' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:23, fontWeight:600, letterSpacing:'-0.015em', lineHeight:1.1 }}>
              {{ dashboard:'Panel general', contacts:'Contactos', pipeline:'Pipeline de ventas', tasks:'Tareas' }[view]}
            </h1>
            <div style={{ fontSize:13, color:'#86847B', marginTop:2 }}>
              {{ dashboard:'Resumen de tu actividad comercial', contacts:'Tu base de clientes y leads', pipeline:'Arrastra los negocios entre etapas', tasks:'Tu lista de pendientes' }[view]}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:9, background:'#fff', border:'1px solid #E2DDD2', borderRadius:10, padding:'8px 12px', width:280 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A988F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contactos, empresas…" style={{ border:'none', outline:'none', background:'transparent', fontFamily:"'IBM Plex Sans',sans-serif", fontSize:13.5, color:'#1B1B18', width:'100%' }} />
          </div>
          <button onClick={handleNew} style={{ display:'flex', alignItems:'center', gap:7, background:'#19191A', color:'#FAF9F6', border:'none', borderRadius:10, padding:'9px 15px', fontFamily:'inherit', fontSize:13.5, fontWeight:500, cursor:'pointer', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            {newButtonLabel}
          </button>
        </header>

        <div style={{ flex:1, overflowY:'auto', padding:'26px 28px 40px' }}>

          {/* DASHBOARD */}
          {view === 'dashboard' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:15, marginBottom:18 }}>
                {metrics.map(m => (
                  <div key={m.label} style={{ background:'#fff', border:'1px solid #EAE6DD', borderRadius:14, padding:'17px 18px', boxShadow:'0 1px 2px rgba(20,18,12,0.04)' }}>
                    <div style={{ fontSize:11.5, color:'#8C8A80', letterSpacing:'0.04em', textTransform:'uppercase', fontWeight:500 }}>{m.label}</div>
                    <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:30, fontWeight:600, letterSpacing:'-0.02em', margin:'9px 0 8px', lineHeight:1 }}>{m.value}</div>
                    <div style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:500, color:m.deltaColor, background:m.deltaBg, padding:'3px 9px', borderRadius:999 }}>{m.delta}</div>
                    <span style={{ fontSize:12, color:'#A3A199', marginLeft:7 }}>{m.sub}</span>
                  </div>
                ))}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1.7fr 1fr', gap:15, alignItems:'start' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:15 }}>
                  {/* FUNNEL */}
                  <div style={{ background:'#fff', border:'1px solid #EAE6DD', borderRadius:14, padding:20, boxShadow:'0 1px 2px rgba(20,18,12,0.04)' }}>
                    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:16 }}>
                      <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:16, fontWeight:600 }}>Embudo de ventas</h2>
                      <span style={{ fontSize:12.5, color:'#9A988F' }}>Por etapa</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                      {funnel.map(f => (
                        <div key={f.name}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ width:9, height:9, borderRadius:3, background:f.color, flexShrink:0, display:'inline-block' }}/>
                            <span style={{ fontSize:13.5, fontWeight:500, flex:1 }}>{f.name}</span>
                            <span style={{ fontSize:12.5, color:'#9A988F' }}>{f.count} neg.</span>
                            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, color:'#3A3A36', width:74, textAlign:'right' }}>{f.valueFmt}</span>
                          </div>
                          <div style={{ height:8, background:'#F0EDE6', borderRadius:6, overflow:'hidden', marginTop:7 }}>
                            <div style={{ height:'100%', width:`${f.pct}%`, background:f.color, borderRadius:6 }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ACTIVITY */}
                  <div style={{ background:'#fff', border:'1px solid #EAE6DD', borderRadius:14, padding:20, boxShadow:'0 1px 2px rgba(20,18,12,0.04)' }}>
                    <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:16, fontWeight:600, marginBottom:6 }}>Actividad reciente</h2>
                    {activitiesView.length === 0 && <div style={{ fontSize:13, color:'#9A988F', padding:'8px 0' }}>Sin actividad registrada.</div>}
                    <div style={{ display:'flex', flexDirection:'column' }}>
                      {activitiesView.slice(0,6).map((a:any, i:number) => (
                        <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'11px 0', borderBottom:'1px solid #F2EFE8' }}>
                          <div style={{ width:32, height:32, borderRadius:9, background:a.bg, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:12, flexShrink:0 }}>{a.initials}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13.5, lineHeight:1.45 }}><span style={{ fontWeight:600 }}>{a.contact_name}</span> <span style={{ color:'#6B6A63' }}>{a.text}</span></div>
                            <div style={{ fontSize:12, color:'#A3A199', marginTop:2 }}>{a.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* TODAY TASKS */}
                <div style={{ background:'#fff', border:'1px solid #EAE6DD', borderRadius:14, padding:20, boxShadow:'0 1px 2px rgba(20,18,12,0.04)' }}>
                  <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
                    <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:16, fontWeight:600 }}>Tareas para hoy</h2>
                    <span style={{ fontSize:12, fontWeight:600, color:'#157A60', background:'#E6F0EB', padding:'2px 9px', borderRadius:999 }}>{pendingToday}</span>
                  </div>
                  {todayTasks.length === 0 && <div style={{ fontSize:13, color:'#9A988F' }}>Sin tareas para hoy.</div>}
                  <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                    {todayTasks.map(t => (
                      <div key={t.id} style={{ display:'flex', alignItems:'center', gap:11, padding:11, border:'1px solid #EEEAE1', borderRadius:11 }}>
                        <div onClick={() => handleToggleTask(t.id)} style={{ width:20, height:20, borderRadius:6, border:`1.6px solid ${t.checkBorder}`, background:t.checkBg, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:t.checkOpacity }}><path d="M5 13l4 4L19 7"/></svg>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13.5, color:t.titleColor, textDecoration:t.titleDeco }}>{t.title}</div>
                          <div style={{ fontSize:12, color:'#A3A199', marginTop:1 }}>{t.due}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CONTACTS */}
          {view === 'contacts' && (
            <div style={{ background:'#fff', border:'1px solid #EAE6DD', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 2px rgba(20,18,12,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid #F0EDE6' }}>
                <span style={{ fontSize:13, color:'#6B6A63' }}>{filteredContacts.length} de {contacts.length} contactos</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'2.4fr 1.6fr 1.1fr 1fr 1fr', gap:12, padding:'11px 18px', borderBottom:'1px solid #F0EDE6', fontSize:11, color:'#9A988F', letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600 }}>
                <span>Contacto</span><span>Empresa</span><span>Estado</span><span style={{ textAlign:'right' }}>Valor</span><span style={{ textAlign:'right' }}>Últ. contacto</span>
              </div>
              {filteredContacts.length === 0 && <div style={{ padding:'28px 18px', fontSize:13, color:'#9A988F' }}>Sin resultados.</div>}
              {filteredContacts.map((c:any) => (
                <div key={c.id} onClick={() => { setSelectedId(c.id); setDetailTab('resumen') }} style={{ display:'grid', gridTemplateColumns:'2.4fr 1.6fr 1.1fr 1fr 1fr', gap:12, alignItems:'center', padding:'13px 18px', borderBottom:'1px solid #F2EFE8', cursor:'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#FAF8F3'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=''}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:11, minWidth:0 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:c.avatarBg, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:13, flexShrink:0 }}>{c.initials}</div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                      <div style={{ fontSize:12.5, color:'#9A988F', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.email}</div>
                    </div>
                  </div>
                  <span style={{ fontSize:13.5, color:'#3A3A36' }}>{c.company}</span>
                  <span><span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:999, background:c.statusBg, color:c.statusColor, fontSize:12, fontWeight:500 }}><span style={{ width:6, height:6, borderRadius:'50%', background:c.statusColor, display:'inline-block' }}/>{c.status}</span></span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, color:'#1B1B18', textAlign:'right' }}>{c.valueFmt}</span>
                  <span style={{ fontSize:12.5, color:'#9A988F', textAlign:'right' }}>{c.last_contact}</span>
                </div>
              ))}
            </div>
          )}

          {/* PIPELINE */}
          {view === 'pipeline' && (
            <div style={{ display:'flex', gap:15, alignItems:'flex-start', overflowX:'auto', paddingBottom:10 }}>
              {columns.map(col => (
                <div key={col.name} style={{ width:278, flexShrink:0 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11, padding:'0 3px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:9, height:9, borderRadius:3, background:col.color, display:'inline-block' }}/>
                      <span style={{ fontWeight:600, fontSize:14 }}>{col.name}</span>
                      <span style={{ fontSize:12.5, color:'#A3A199', background:'#EAE6DD', borderRadius:999, padding:'0 7px' }}>{col.count}</span>
                    </div>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, color:'#6B6A63' }}>{col.valueFmt}</span>
                  </div>
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); if (dragId) handleDrop(col.name, dragId) }}
                    style={{ display:'flex', flexDirection:'column', gap:10, minHeight:140, padding:9, borderRadius:14, background:'#ECE9E1', borderTop:`3px solid ${col.color}` }}
                  >
                    {col.deals.map((deal:any) => (
                      <div key={deal.id} draggable
                        onDragStart={e => { dragId = String(deal.id); e.dataTransfer.effectAllowed = 'move' }}
                        style={{ background:'#fff', border:'1px solid #EAE6DD', borderRadius:11, padding:13, cursor:'grab', boxShadow:'0 1px 2px rgba(20,18,12,0.05)' }}
                      >
                        <div style={{ fontWeight:600, fontSize:13.5, marginBottom:2, lineHeight:1.25 }}>{deal.title}</div>
                        <div style={{ fontSize:12.5, color:'#8A887F', marginBottom:11 }}>{deal.company}</div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13.5, fontWeight:500, color:'#1B1B18' }}>{deal.valueFmt}</span>
                          <span style={{ width:24, height:24, borderRadius:7, background:deal.ownerBg, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10.5, fontWeight:600 }}>{deal.ownerInitials}</span>
                        </div>
                      </div>
                    ))}
                    {col.deals.length === 0 && <div style={{ fontSize:12, color:'#A3A199', textAlign:'center', paddingTop:20 }}>Arrastra aquí</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TASKS */}
          {view === 'tasks' && (
            <div style={{ maxWidth:680, display:'flex', flexDirection:'column', gap:9 }}>
              {tasksView.length === 0 && <div style={{ fontSize:13, color:'#9A988F' }}>Sin tareas.</div>}
              {tasksView.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:13, padding:'14px 16px', border:'1px solid #EAE6DD', borderRadius:12, background:'#fff', boxShadow:'0 1px 2px rgba(20,18,12,0.04)' }}>
                  <div onClick={() => handleToggleTask(t.id)} style={{ width:21, height:21, borderRadius:6, border:`1.6px solid ${t.checkBorder}`, background:t.checkBg, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:t.checkOpacity }}><path d="M5 13l4 4L19 7"/></svg>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, color:t.titleColor, textDecoration:t.titleDeco }}>{t.title}</div>
                    <div style={{ fontSize:12.5, color:'#A3A199', marginTop:2 }}>{t.due}</div>
                  </div>
                  <div style={{ width:30, height:30, borderRadius:9, background:t.contactBg, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:11.5, flexShrink:0 }}>{t.contactInitials}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* CONTACT DETAIL PANEL */}
      {selected && (
        <>
          <div onClick={() => setSelectedId(null)} style={{ position:'fixed', inset:0, background:'rgba(20,18,12,0.32)', zIndex:40 }}/>
          <div style={{ position:'fixed', top:0, right:0, height:'100vh', width:432, background:'#fff', zIndex:50, boxShadow:'-10px 0 40px rgba(0,0,0,0.16)', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'22px 24px 18px', borderBottom:'1px solid #EFEBE3' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                <div style={{ width:52, height:52, borderRadius:14, background:selected.avatarBg, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, fontSize:19, flexShrink:0 }}>{selected.initials}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:20, fontWeight:600, letterSpacing:'-0.01em' }}>{selected.name}</h2>
                  <div style={{ fontSize:13.5, color:'#86847B', marginTop:1 }}>{selected.company}</div>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:999, background:selected.statusBg, color:selected.statusColor, fontSize:12, fontWeight:500, marginTop:8 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:selected.statusColor, display:'inline-block' }}/>{selected.status}
                  </span>
                </div>
                <button onClick={() => setSelectedId(null)} style={{ background:'#F2EFE8', border:'none', width:32, height:32, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6B6A63" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                {[
                  { label:'Llamar', icon:'M5 4h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2' },
                  { label:'Email', icon:'M4 6h16v12H4zM4 7l8 6 8-6' },
                  { label:'Tarea', icon:'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
                ].map((btn, i) => (
                  <button key={btn.label} onClick={() => showToast(`${btn.label}: ${selected.name}`)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, background: i===0?'#19191A':'#fff', color: i===0?'#fff':'#1B1B18', border: i===0?'none':'1px solid #E2DDD2', borderRadius:9, padding:9, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={btn.icon}/></svg>{btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:4, padding:'12px 18px 0', borderBottom:'1px solid #EFEBE3' }}>
              {(['resumen','actividad','notas'] as DetailTab[]).map(tab => (
                <span key={tab} onClick={() => setDetailTab(tab)} style={{ fontSize:13.5, fontWeight:500, padding:'8px 12px 11px', cursor:'pointer', ...tabStyle(tab) }}>
                  {tab.charAt(0).toUpperCase()+tab.slice(1)}
                </span>
              ))}
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'20px 24px 28px' }}>
              {detailTab === 'resumen' && (
                <>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:22 }}>
                    {[['Email',selected.email],['Teléfono',selected.phone],['Propietario',selected.owner],['Valor total',selected.valueFmt],['Últ. contacto',selected.last_contact]].map(([label,val]) => (
                      <div key={label} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #F2EFE8' }}>
                        <span style={{ fontSize:12.5, color:'#9A988F', width:96 }}>{label}</span>
                        <span style={{ fontSize:13.5, color:'#1B1B18' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <h3 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:14, fontWeight:600, marginBottom:11 }}>Negocios asociados</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                    {detailDeals.length === 0 && <div style={{ fontSize:13, color:'#9A988F' }}>Sin negocios asociados.</div>}
                    {detailDeals.map((d:any) => (
                      <div key={d.id} style={{ display:'flex', alignItems:'center', gap:11, padding:12, border:'1px solid #EEEAE1', borderRadius:11 }}>
                        <span style={{ width:8, height:34, borderRadius:4, background:d.stageColor, flexShrink:0, display:'inline-block' }}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13.5, fontWeight:500 }}>{d.title}</div>
                          <div style={{ fontSize:12, color:'#9A988F', marginTop:1 }}>{d.stage}</div>
                        </div>
                        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:13, color:'#1B1B18' }}>{d.valueFmt}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {detailTab === 'actividad' && (
                <div style={{ display:'flex', flexDirection:'column' }}>
                  {detailActs.length === 0 && <div style={{ fontSize:13, color:'#9A988F' }}>Sin actividad registrada.</div>}
                  {detailActs.map((a:any, i:number) => (
                    <div key={i} style={{ display:'flex', gap:12, paddingBottom:18, position:'relative' }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                        <div style={{ width:30, height:30, borderRadius:9, background:a.bg, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon}/></svg>
                        </div>
                        {i < detailActs.length-1 && <div style={{ width:2, flex:1, background:'#EFEBE3', marginTop:4 }}/>}
                      </div>
                      <div style={{ flex:1, paddingTop:3 }}>
                        <div style={{ fontSize:13.5, color:'#1B1B18', lineHeight:1.45 }}>{a.text}</div>
                        <div style={{ fontSize:12, color:'#A3A199', marginTop:3 }}>{a.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'notas' && (
                <>
                  <div style={{ background:'#FAF8F3', border:'1px solid #EEEAE1', borderRadius:11, padding:14, fontSize:13.5, color:'#3A3A36', lineHeight:1.55, marginBottom:14 }}>
                    {selected.notesDisplay}
                  </div>
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Añadir una nota…" style={{ width:'100%', minHeight:96, border:'1px solid #E2DDD2', borderRadius:11, padding:12, fontFamily:"'IBM Plex Sans',sans-serif", fontSize:13.5, color:'#1B1B18', outline:'none', resize:'vertical' }}/>
                  <button onClick={handleSaveNote} style={{ marginTop:10, background:'#19191A', color:'#fff', border:'none', borderRadius:9, padding:'9px 16px', fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer' }}>Guardar nota</button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL NUEVO CONTACTO */}
      {modal === 'contact' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(20,18,12,0.40)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setModal(null)}>
          <form onSubmit={handleCreateContact} style={{ background:'#fff', borderRadius:16, padding:28, width:440, display:'flex', flexDirection:'column', gap:14 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:18, fontWeight:600, marginBottom:4 }}>Nuevo contacto</h2>
            {[['Nombre','name','text',true],['Empresa','company','text',false],['Email','email','email',false],['Teléfono','phone','tel',false],['Propietario','owner','text',false]].map(([label,key,type,req]) => (
              <div key={key as string}>
                <label style={LABEL}>{label as string}</label>
                <input required={!!req} type={type as string} value={(cf as any)[key as string]} onChange={e => setCf(p => ({...p,[key as string]:e.target.value}))} style={{ ...Object.fromEntries(INPUT.split(';').map(s => s.split(':'))) }} />
              </div>
            ))}
            <div>
              <label style={LABEL}>Estado</label>
              <select value={cf.status} onChange={e => setCf(p => ({...p,status:e.target.value}))} style={{ ...Object.fromEntries(INPUT.split(';').map(s => s.split(':'))) }}>
                {['Lead','Oportunidad','Cliente','Inactivo'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Valor (€)</label>
              <input type="number" value={cf.value} onChange={e => setCf(p => ({...p,value:e.target.value}))} style={{ ...Object.fromEntries(INPUT.split(';').map(s => s.split(':'))) }} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" onClick={() => setModal(null)} style={{ flex:1, padding:'10px', border:'1px solid #E2DDD2', borderRadius:9, background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13.5 }}>Cancelar</button>
              <button type="submit" style={{ flex:1, padding:'10px', border:'none', borderRadius:9, background:'#19191A', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13.5, fontWeight:600 }}>Crear contacto</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NUEVO NEGOCIO */}
      {modal === 'deal' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(20,18,12,0.40)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setModal(null)}>
          <form onSubmit={handleCreateDeal} style={{ background:'#fff', borderRadius:16, padding:28, width:400, display:'flex', flexDirection:'column', gap:14 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:18, fontWeight:600, marginBottom:4 }}>Nuevo negocio</h2>
            {[['Título','title','text',true],['Empresa','company','text',false],['Propietario','owner','text',false]].map(([label,key,type,req]) => (
              <div key={key as string}>
                <label style={LABEL}>{label as string}</label>
                <input required={!!req} type={type as string} value={(df as any)[key as string]} onChange={e => setDf(p => ({...p,[key as string]:e.target.value}))} style={{ ...Object.fromEntries(INPUT.split(';').map(s => s.split(':'))) }} />
              </div>
            ))}
            <div>
              <label style={LABEL}>Etapa</label>
              <select value={df.stage} onChange={e => setDf(p => ({...p,stage:e.target.value}))} style={{ ...Object.fromEntries(INPUT.split(';').map(s => s.split(':'))) }}>
                {STAGES.map(s => <option key={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Valor (€)</label>
              <input type="number" value={df.value} onChange={e => setDf(p => ({...p,value:e.target.value}))} style={{ ...Object.fromEntries(INPUT.split(';').map(s => s.split(':'))) }} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" onClick={() => setModal(null)} style={{ flex:1, padding:'10px', border:'1px solid #E2DDD2', borderRadius:9, background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13.5 }}>Cancelar</button>
              <button type="submit" style={{ flex:1, padding:'10px', border:'none', borderRadius:9, background:'#19191A', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13.5, fontWeight:600 }}>Crear negocio</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL NUEVA TAREA */}
      {modal === 'task' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(20,18,12,0.40)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setModal(null)}>
          <form onSubmit={handleCreateTask} style={{ background:'#fff', borderRadius:16, padding:28, width:380, display:'flex', flexDirection:'column', gap:14 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:18, fontWeight:600, marginBottom:4 }}>Nueva tarea</h2>
            <div>
              <label style={LABEL}>Título</label>
              <input required type="text" value={tf.title} onChange={e => setTf(p => ({...p,title:e.target.value}))} style={{ ...Object.fromEntries(INPUT.split(';').map(s => s.split(':'))) }} />
            </div>
            <div>
              <label style={LABEL}>Vencimiento</label>
              <input type="text" placeholder="Hoy · 16:00" value={tf.due} onChange={e => setTf(p => ({...p,due:e.target.value}))} style={{ ...Object.fromEntries(INPUT.split(';').map(s => s.split(':'))) }} />
            </div>
            <div>
              <label style={LABEL}>Contacto</label>
              <input type="text" value={tf.contact_name} onChange={e => setTf(p => ({...p,contact_name:e.target.value}))} style={{ ...Object.fromEntries(INPUT.split(';').map(s => s.split(':'))) }} />
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', fontSize:13.5 }}>
              <input type="checkbox" checked={tf.today} onChange={e => setTf(p => ({...p,today:e.target.checked}))} />
              Tarea para hoy
            </label>
            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" onClick={() => setModal(null)} style={{ flex:1, padding:'10px', border:'1px solid #E2DDD2', borderRadius:9, background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13.5 }}>Cancelar</button>
              <button type="submit" style={{ flex:1, padding:'10px', border:'none', borderRadius:9, background:'#19191A', color:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13.5, fontWeight:600 }}>Crear tarea</button>
            </div>
          </form>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', zIndex:70, background:'#19191A', color:'#FAF9F6', padding:'12px 20px', borderRadius:11, fontSize:13.5, boxShadow:'0 10px 30px rgba(0,0,0,0.25)', display:'flex', alignItems:'center', gap:10 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5FD0A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          {toast}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
      `}</style>
    </div>
  )
}
