import { supabase } from './supabase';

export type RoomRow = {
  code: string;
  created_at: number;
  started: boolean;
  seed: number;
};

export async function fetchRoom(code: string): Promise<RoomRow> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code)
    .single();
  if (error) throw error;
  return data as RoomRow;
}

export async function createRoom(code: string, seed: number) {
  const { error } = await supabase
    .from('rooms')
    .insert({ code, seed, started: false, created_at: Date.now() });
  if (error) throw error;
}

export async function markGameStarted(code: string, started: boolean) {
  const { error } = await supabase
    .from('rooms')
    .update({ started })
    .eq('code', code);
  if (error) throw error;
}

export async function resetRoomForReplay(code: string, newSeed: number) {
  const { error } = await supabase
    .from('rooms')
    .update({ started: false, seed: newSeed })
    .eq('code', code);
  if (error) throw error;
}

export async function listPlayers(code: string) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('code', code)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function joinRoom(code: string, name: string) {
  const { error } = await supabase
    .from('players')
    .insert({ code, name, joined_at: Date.now() });
  if (error) throw error;
}
