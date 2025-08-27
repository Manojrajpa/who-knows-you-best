import React, { useState } from 'react'
import { supabase, newPlayerId } from '../lib/supabase'

type Props = {
  onEnter: (payload: { gameId: string, playerId: string, isHost: boolean }) => void
}

async function createGame(name: string) {
  const playerId = newPlayerId()
  const code = Math.random().toString(36).substring(2, 6).toUpperCase()
  const { data: game, error } = await supabase
    .from('games')
    .insert({ code, host_id: playerId, status: 'lobby', num_questions: 5 })
    .select()
    .single()
  if (error) throw error

  const { error: perr } = await supabase
    .from('players')
    .insert({ id: playerId, game_id: game.id, name, is_host: true, is_qm: true, score: 0 })
  if (perr) throw perr

  return { gameId: game.id, playerId, code }
}

async function joinGame(code: string, name: string) {
  const playerId = newPlayerId()
  const { data: game, error } = await supabase
    .from('games')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()
  if (error) throw error

  const { error: perr } = await supabase
    .from('players')
    .insert({ id: playerId, game_id: game.id, name, is_host: false, is_qm: false, score: 0 })
  if (perr) throw perr

  return { gameId: game.id, playerId }
}

export default function Lobby({ onEnter }: Props) {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className='card' style={{ maxWidth: 620, margin: '48px auto', padding: 20 }}>
      <h1 className='heading' style={{ marginBottom: 8 }}>Who Knows You Better?</h1>
      <p className='kicker' style={{ marginTop: 0 }}>Host a room or join with a code.</p>

      <div style={{ marginTop: 24 }}>
        <label>Display name</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className='input' style={{ marginTop:6 }}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
        <button onClick={async ()=>{
          try{
            setError(null); setLoading(true)
            const res = await createGame(name.trim())
            setCreatedCode(res.code)
            onEnter({ gameId: res.gameId, playerId: res.playerId, isHost: true })
          } catch (e:any) {
            setError(e.message || 'Failed to create game')
          } finally {
            setLoading(false)
          }
        }} disabled={!name || loading} className='btn btn-primary' style={{ padding:12 }}>
          Host Game
        </button>

        <div style={{ display:'flex', gap:8 }}>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Enter code" className='input' style={{ flex:1 }} />
          <button onClick={async ()=>{
            try{
              setError(null); setLoading(true)
              const res = await joinGame(joinCode.trim(), name.trim())
              onEnter({ gameId: res.gameId, playerId: res.playerId, isHost: false })
            } catch (e:any) {
              setError(e.message || 'Failed to join')
            } finally {
              setLoading(false)
            }
          }} disabled={!name || !joinCode || loading} className='btn'>
            Join
          </button>
        </div>
      </div>

      {createdCode && (
        <div style={{ marginTop:16, padding:12, border:'1px dashed #ccc', borderRadius:12 }}>
          <div>Share this code with friends:</div>
          <div style={{ fontSize:26, fontWeight:700, letterSpacing:2 }}>{createdCode}</div>
        </div>
      )}

      {error && <div style={{ marginTop:12, color:'crimson' }}>{error}</div>}
    </div>
  )
}
