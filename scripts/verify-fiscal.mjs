// Verificación end-to-end de la capa fiscal (007 triggers + 008 RPCs).
// NO llama a Verifacti/AEAT: simula la respuesta con una huella dummy.
// Uso: node scripts/verify-fiscal.mjs
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// --- cargar .env.local manualmente ---
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Faltan env vars'); process.exit(1) }

const sb = createClient(url, key, { auth: { persistSession: false } })

const results = []
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`) }
const TAG = 'TEST FISCAL (no borrar)'

let restaurantId, zoneId, tableId, orderId, ticketA, ticketB

try {
  // ── 1. Restaurante de prueba (reutiliza el existente si ya lo creamos) ─────
  const { data: existing } = await sb.from('restaurants').select('id').eq('name', TAG).limit(1).maybeSingle()
  if (existing) {
    restaurantId = existing.id
  } else {
    const slug = 'test-fiscal-' + Date.now()
    const { data: rest, error: rErr } = await sb.from('restaurants').insert({
      name: TAG, slug, nif: 'X0000000T', primary_color: '#888888',
      country_code: 'ES', timezone: 'Europe/Madrid', currency: 'EUR',
      subscription_status: 'trial', subscription_plan: 'basic',
      settings: {}, verifactu_enabled: false, verifactu_serie: 'A',
      verifactu_last_number: 0, onboarding_completed: true, onboarding_step: 0,
    }).select('id').single()
    if (rErr) throw new Error('crear restaurante: ' + rErr.message)
    restaurantId = rest.id
  }
  console.log('restaurante test:', restaurantId)

  // ── 2. Zona + mesa + orden ────────────────────────────────────────────────
  const { data: zone, error: zErr } = await sb.from('zones').insert({
    restaurant_id: restaurantId, name: 'Z-test', color: '#94a3b8', is_active: true, position: 0,
  }).select('id').single()
  if (zErr) throw new Error('crear zona: ' + zErr.message)
  zoneId = zone.id

  const { data: table, error: tErr } = await sb.from('tables').insert({
    zone_id: zoneId, restaurant_id: restaurantId, name: 'M-test',
    capacity: 4, status: 'free', is_active: true, position: 0,
  }).select('id').single()
  if (tErr) throw new Error('crear mesa: ' + tErr.message)
  tableId = table.id

  const { data: order, error: oErr } = await sb.from('orders').insert({
    restaurant_id: restaurantId, table_id: tableId, status: 'paid', type: 'dine_in',
    order_number: 1, opened_at: new Date().toISOString(), order_date: new Date().toISOString().slice(0, 10),
  }).select('id').single()
  if (oErr) throw new Error('crear orden: ' + oErr.message)
  orderId = order.id

  // ── 3. Dos tickets de prueba (para verificar el encadenado prev_hash) ──────
  const baseTicket = (seq) => ({
    restaurant_id: restaurantId, order_id: orderId,
    ticket_number: `A-${String(seq).padStart(8, '0')}`, series: 'A', sequential_number: seq,
    issuer_name: TAG, issuer_nif: 'X0000000T', issuer_address: 'C/ Test 1',
    issued_at: new Date().toISOString(), subtotal: 10, tax_breakdown: [{ rate: 21, base: 10, amount: 2.1 }],
    tax_total: 2.1, total: 12.1, payment_method: 'cash',
  })
  const seqBase = Math.floor(Date.now() / 1000) % 9000000
  const { data: tA, error: aErr } = await sb.from('tickets').insert(baseTicket(seqBase)).select('id').single()
  if (aErr) throw new Error('crear ticket A: ' + aErr.message)
  ticketA = tA.id
  const { data: tB, error: bErr } = await sb.from('tickets').insert(baseTicket(seqBase + 1)).select('id').single()
  if (bErr) throw new Error('crear ticket B: ' + bErr.message)
  ticketB = tB.id

  // ── 4. claim emisión A ────────────────────────────────────────────────────
  const { data: claimA, error: cErr } = await sb.rpc('fiscal_claim_emision', { p_ticket_id: ticketA })
  ok('fiscal_claim_emision(A) sin error', !cErr, cErr?.message)
  ok("claim deja verifactu_status='enviando'", claimA?.verifactu_status === 'enviando', `status=${claimA?.verifactu_status}`)

  // ── 5. persistir emisión A (huella dummy) ─────────────────────────────────
  const HASH_A = 'DUMMY_HASH_A_' + Date.now()
  const { data: persA, error: pErr } = await sb.rpc('fiscal_persistir_emision', {
    p_ticket_id: ticketA, p_huella: HASH_A, p_estado: 'Correcto', p_respuesta: { uuid: 'u-A', estado: 'Correcto', huella: HASH_A },
  })
  ok('fiscal_persistir_emision(A) sin error', !pErr, pErr?.message)
  ok('A: verifactu_hash escrito', persA?.verifactu_hash === HASH_A)
  ok('A: verifactu_status persistido', persA?.verifactu_status === 'Correcto', `status=${persA?.verifactu_status}`)
  ok('A: verifactu_sent_at fijado', !!persA?.verifactu_sent_at)
  ok('A: verifactu_prev_hash NULL (primer ticket)', persA?.verifactu_prev_hash === null, `prev=${persA?.verifactu_prev_hash}`)

  // ── 6. emisión B → prev_hash debe ser la huella de A ──────────────────────
  await sb.rpc('fiscal_claim_emision', { p_ticket_id: ticketB })
  const HASH_B = 'DUMMY_HASH_B_' + Date.now()
  const { data: persB, error: pErrB } = await sb.rpc('fiscal_persistir_emision', {
    p_ticket_id: ticketB, p_huella: HASH_B, p_estado: 'Correcto', p_respuesta: { uuid: 'u-B', estado: 'Correcto', huella: HASH_B },
  })
  ok('fiscal_persistir_emision(B) sin error', !pErrB, pErrB?.message)
  ok('B: prev_hash == huella de A (encadenado)', persB?.verifactu_prev_hash === HASH_A, `prev=${persB?.verifactu_prev_hash} esperado=${HASH_A}`)

  // ── 7. re-emisión de A ya emitida → debe RECHAZARSE ───────────────────────
  const { error: reErr } = await sb.rpc('fiscal_claim_emision', { p_ticket_id: ticketA })
  ok('re-claim de ticket ya emitido RECHAZADO', !!reErr, reErr?.message ?? '(no lanzó error!)')

  // ── 8. anular A ───────────────────────────────────────────────────────────
  const { data: anulA, error: anErr } = await sb.rpc('fiscal_anular_ticket', { p_ticket_id: ticketA, p_motivo: 'prueba' })
  ok('fiscal_anular_ticket(A) sin error', !anErr, anErr?.message)
  ok('A: anulado=true', anulA?.anulado === true)
  ok('A: anulado_at fijado', !!anulA?.anulado_at)
  ok('A: motivo_anulacion guardado', anulA?.motivo_anulacion === 'prueba', `motivo=${anulA?.motivo_anulacion}`)

  // ── 9. doble anulación → debe RECHAZARSE ──────────────────────────────────
  const { error: an2Err } = await sb.rpc('fiscal_anular_ticket', { p_ticket_id: ticketA, p_motivo: 'otra' })
  ok('doble anulación RECHAZADA', !!an2Err, an2Err?.message ?? '(no lanzó error!)')

  // ── 10. trigger inmutabilidad: UPDATE directo de columna congelada ────────
  const { error: immErr } = await sb.from('tickets').update({ total: 999 }).eq('id', ticketB)
  ok('UPDATE directo de columna congelada (total) RECHAZADO', !!immErr, immErr?.message ?? '(no lanzó error!)')

  // ── 11. trigger: DELETE de ticket ─────────────────────────────────────────
  const { error: delErr } = await sb.from('tickets').delete().eq('id', ticketB)
  ok('DELETE de ticket RECHAZADO', !!delErr, delErr?.message ?? '(no lanzó error!)')

} catch (e) {
  ok('EJECUCIÓN', false, e.message)
} finally {
  // Limpieza de lo que SÍ se puede borrar (tickets/payments no, por diseño 007).
  // El order no se puede borrar (FK desde tickets). Dejamos la cadena marcada TAG.
  console.log('\n--- RESUMEN ---')
  const pass = results.filter(r => r.pass).length
  console.log(`${pass}/${results.length} comprobaciones OK`)
  console.log('IDs de prueba (permanecen en prod, restaurante marcado "' + TAG + '"):')
  console.log({ restaurantId, orderId, ticketA, ticketB })
}
