import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wbfaoymowwmbokggtsgh.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiZmFveW1vd3dtYm9rZ2d0c2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMTYxNzAsImV4cCI6MjA3MTY5MjE3MH0.gbnsVxgeliyjWyuRTxyXtMbMRfjAuxFKuT6S33TWp-E'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
})

// generate a brand-new player id each time you host/join
export function newPlayerId(): string {
  return crypto.randomUUID()
}
