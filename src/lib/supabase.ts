import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nmmbhogmxupnbmngsvnn.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tbWJob2dteHVwbmJtbmdzdm5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTA1NTYsImV4cCI6MjA4NzY4NjU1Nn0.IBzVuf-F02bW-KJ6o7wcydzMDLXYqTPqz9QKA4WQxTk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
})

// generate a brand-new player id each time you host/join
export function newPlayerId(): string {
  return crypto.randomUUID()
}