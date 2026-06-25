'use server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getCrmData() {
  const db = getSupabaseAdmin()
  const [contacts, deals, tasks, activities] = await Promise.all([
    db.from('crm_contacts').select('*').order('created_at', { ascending: false }),
    db.from('crm_deals').select('*').order('created_at', { ascending: false }),
    db.from('crm_tasks').select('*').order('created_at', { ascending: true }),
    db.from('crm_activities').select('*').order('created_at', { ascending: false }).limit(30),
  ])
  return {
    contacts: contacts.data ?? [],
    deals: deals.data ?? [],
    tasks: tasks.data ?? [],
    activities: activities.data ?? [],
  }
}

export async function toggleTask(id: number, done: boolean) {
  await getSupabaseAdmin().from('crm_tasks').update({ done }).eq('id', id)
  revalidatePath('/crm')
}

export async function moveDeal(id: number, stage: string) {
  await getSupabaseAdmin().from('crm_deals').update({ stage }).eq('id', id)
  revalidatePath('/crm')
}

export async function createContact(data: {
  name: string; company: string; email: string; phone: string
  status: string; value: number; owner: string; notes: string
}) {
  const { error } = await getSupabaseAdmin().from('crm_contacts').insert({
    ...data,
    last_contact: 'hoy',
  })
  if (error) return { error: error.message }
  revalidatePath('/crm')
  return { ok: true }
}

export async function createDeal(data: {
  title: string; company: string; value: number; stage: string; owner: string; contact_id?: number
}) {
  const { error } = await getSupabaseAdmin().from('crm_deals').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/crm')
  return { ok: true }
}

export async function createTask(data: {
  title: string; due: string; contact_name: string; today: boolean
}) {
  const { error } = await getSupabaseAdmin().from('crm_tasks').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/crm')
  return { ok: true }
}

export async function addNote(contactId: number, contactName: string, notes: string) {
  await getSupabaseAdmin().from('crm_contacts').update({ notes }).eq('id', contactId)
  await getSupabaseAdmin().from('crm_activities').insert({
    type: 'note', contact_id: contactId, contact_name: contactName,
    text: 'añadió una nota',
  })
  revalidatePath('/crm')
}

export async function updateContactLastContact(id: number) {
  await getSupabaseAdmin().from('crm_contacts').update({ last_contact: 'hoy' }).eq('id', id)
  revalidatePath('/crm')
}
