import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { QUESTION_BANK } from '../questions'
import Celebration from './Celebration'

type Props = {
  gameId: string
  playerId: string
}

type Game = {
  id: string
  code: string
  status: 'lobby' | 'reviewing' | 'answering' | 'reveal' | 'scoring' | 'complete'
  host_id: string
  qm_id: string | null
  num_questions: number
}

type Player = {
  id: string
  game_id: string
  name: string
  is_host: boolean
  is_qm: boolean
  score: number
}

type Round = {
  id: string
  game_id: string
  round_number: number
  question: string | null
  status: Game['status']
}

type Answer = {
  id: string
  round_id: string
  player_id: string
  answer_text: string | null
  done: boolean
  is_correct: boolean | null
  revealed: boolean
}

async function fetchGame(gameId: string): Promise<Game> {
  const { data, error } = await supabase.from('games').select('*').eq('id', gameId).single()
  if (error) throw error
  return data as Game
}

async function fetchPlayers(gameId: string): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('*').eq('game_id', gameId).order('joined_at')
  if (error) throw error
  return data as Player[]
}

async function fetchActiveRound(gameId: string): Promise<Round | null> {
  const { data, error } = await supabase.from('rounds').select('*').eq('game_id', gameId).order('round_number', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data as Round | null
}



async function refreshAll(gameId: string, setGame: any, setPlayers: any, setRound: any){
  try{
    const g = await fetchGame(gameId)
    const p = await fetchPlayers(gameId)
    const r = await fetchActiveRound(gameId)
    setGame(g); setPlayers(p); setRound(r)
  } catch {}
}
export default function GameRoom({ gameId, playerId }: Props) {
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [round, setRound] = useState<Round | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const me = useMemo(()=> players.find(p=>p.id===playerId), [players, playerId])

  useEffect(()=>{
    (async ()=>{
      const [g, pls, r] = await Promise.all([fetchGame(gameId), fetchPlayers(gameId), fetchActiveRound(gameId)])
      setGame(g); setPlayers(pls); setRound(r)
      if (r) {
        const { data } = await supabase.from('answers').select('*').eq('round_id', r.id)
        setAnswers(data||[])
      }
    })()

    const gs = supabase.channel('games_'+gameId).on('postgres_changes', { event:'UPDATE', schema:'public', table:'games', filter: `id=eq.${gameId}`}, payload=>{
      setGame(payload.new as Game)
    }).subscribe()

    const ps = supabase.channel('players_'+gameId).on('postgres_changes', { event:'INSERT', schema:'public', table:'players', filter: `game_id=eq.${gameId}`}, payload=>{
      setPlayers(prev=>[...prev, payload.new as Player])
    }).on('postgres_changes', { event:'UPDATE', schema:'public', table:'players', filter: `game_id=eq.${gameId}`}, payload=>{
      setPlayers(prev=>prev.map(p=>p.id===payload.new.id?payload.new as Player:p))
    }).subscribe()

    const rs = supabase.channel('rounds_'+gameId).on('postgres_changes', { event:'INSERT', schema:'public', table:'rounds', filter: `game_id=eq.${gameId}`}, payload=>{
      setRound(payload.new as Round)
    }).on('postgres_changes', { event:'UPDATE', schema:'public', table:'rounds', filter: `game_id=eq.${gameId}`}, payload=>{
      setRound(payload.new as Round)
    }).subscribe()

    const as = supabase.channel('answers_'+gameId).on('postgres_changes', { event:'INSERT', schema:'public', table:'answers' }, payload=>{
      const a = payload.new as Answer
      setAnswers(prev=> prev.find(x=>x.id===a.id)?prev:[...prev, a])
    }).on('postgres_changes', { event:'UPDATE', schema:'public', table:'answers' }, payload=>{
      const a = payload.new as Answer
      setAnswers(prev=> prev.map(x=>x.id===a.id?a:x))
    }).subscribe()

    return ()=>{
      supabase.removeChannel(gs); supabase.removeChannel(ps); supabase.removeChannel(rs); supabase.removeChannel(as)
    }
  }, [gameId])

  if (!game || !me) return <div style={{ padding:20 }}>Loading...</div>

  const isQM = me.is_qm
  const isHost = me.is_host

  async function assignQM(player: Player){
    await supabase.from('players').update({ is_qm: false }).eq('game_id', gameId)
    await supabase.from('players').update({ is_qm: true }).eq('id', player.id)
    await supabase.from('games').update({ qm_id: player.id }).eq('id', gameId)
  }

  async function setNumQuestions(n: number){
    await supabase.from('games').update({ num_questions: n }).eq('id', gameId)
  }

  async function startOrNextRound(){
    const { data: prev } = await supabase.from('rounds').select('question').eq('game_id', gameId)
    const used = new Set((prev||[]).map((r:any)=>r.question))
    const pool = QUESTION_BANK.filter(q=>!used.has(q))
    const pickFrom = pool.length ? pool : QUESTION_BANK
    const q = pickFrom[Math.floor(Math.random()*pickFrom.length)]
    const current = round
    const nextNumber = current ? current.round_number + 1 : 1
    const { data, error } = await supabase.from('rounds').insert({
      game_id: gameId,
      round_number: nextNumber,
      question: q,
      status: 'reviewing'
    }).select().single()
    if (error) throw error
    setRound(data as Round)
  }

  async function approveQuestion(){
    if (!round) return
    await supabase.from('rounds').update({ status: 'answering' }).eq('id', round.id)
    const rows = players.map(p => ({ round_id: round.id, player_id: p.id, answer_text: null, done: false, is_correct: null, revealed: false }))
    await supabase.from('answers').insert(rows)
  }

  async function skipQuestion(){
    if (!round) return
    const q = QUESTION_BANK[Math.floor(Math.random()*QUESTION_BANK.length)]
    await supabase.from('rounds').update({ question: q }).eq('id', round.id)
  }

  async function submitMyAnswer(text: string){
    if (!round) return
    const mine = answers.find(a=>a.player_id===playerId && a.round_id===round.id)
    if (mine){
      await supabase.from('answers').update({ answer_text: text || '', done: true }).eq('id', mine.id)
    } else {
      await supabase.from('answers').insert({ round_id: round.id, player_id: playerId, answer_text: text || '', done: true })
    }
  }

  async function revealAnswers(){
    if (!round) return
    await supabase.from('rounds').update({ status: 'reveal' }).eq('id', round.id)
    await supabase.from('answers').update({ revealed: true }).eq('round_id', round.id)
  }

  async function markCorrect(playerIdToMark: string, isCorrect: boolean){
    if (!round) return
    const ans = answers.find(a=>a.player_id===playerIdToMark && a.round_id===round.id)
    if (ans){
      await supabase.from('answers').update({ is_correct: isCorrect }).eq('id', ans.id)
    }
  }

  async function submitScores(){
    if (!round) return
    const correctIds = answers.filter(a=>a.round_id===round.id && a.is_correct===true).map(a=>a.player_id)
    const qm = players.find(x=>x.is_qm)
    for (const pid of correctIds){
      const p = players.find(x=>x.id===pid)
      if (p && (!qm || qm.id !== pid)){ // skip QM
        await supabase.from('players').update({ score: p.score + 1 }).eq('id', pid)
      }
    }
    await supabase.from('rounds').update({ status: 'scoring' }).eq('id', round.id)

    const nextNumber = round.round_number + 1
    if (nextNumber <= game.num_questions) {
      await startOrNextRound()
    } else {
      await supabase.from('games').update({ status: 'complete' }).eq('id', gameId)
    }
  }

  async function endGameNow(){
    await supabase.from('games').update({ status: 'complete' }).eq('id', gameId)
  }

  async function playAgain(){
    // wipe old rounds + answers and reset scores
    const { data: rds } = await supabase.from('rounds').select('id').eq('game_id', gameId)
    if (rds && rds.length){
      const ids = rds.map(r=>r.id)
      await supabase.from('answers').delete().in('round_id', ids)
      await supabase.from('rounds').delete().eq('game_id', gameId)
    }
    await supabase.from('players').update({ score: 0 }).eq('game_id', gameId)
    await supabase.from('games').update({ status: 'lobby' }).eq('id', gameId)
  }

  const roundAnswers = answers.filter(a=>round && a.round_id===round.id)
  const leaderboard = [...players].sort((a,b)=> b.score - a.score || a.name.localeCompare(b.name))
  const topScore = leaderboard.length ? leaderboard[0].score : 0
  const winners = leaderboard.filter(p=>p.score === topScore)

  if (game.status === 'complete'){
    return (
      <div style={{ maxWidth: 860, margin:'24px auto', padding: 16 }}>
        <Celebration fire />
        <div className="card" style={{ padding: 18 }}>
          <div className="kicker">Game {game.code}</div>
          <h2 className="heading">Final Scores</h2>
          <div className="winner-banner" style={{ marginTop: 8, marginBottom: 12 }}>
            <strong>Winner{winners.length>1?'s':''}:</strong> {winners.map(w=>w.name).join(', ')} 🎉
            <div style={{ fontSize: 12 }}>Top Score: {topScore}</div>
          </div>
          <div className="card" style={{ padding: 8, background:'rgba(255,255,255,0.8)' }}>
            {leaderboard.map((p, idx)=>(
              <div key={p.id} className="leader-row">
                <div>#{idx+1} — <strong>{p.name}</strong></div>
                <div>{p.score} pts</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display:'flex', gap:8, alignItems:'center' }}>
            <span className="kicker" style={{ flex:1 }}>Thanks for playing!</span>
            {isHost && (<button className="btn btn-primary" onClick={playAgain}>Play Again</button>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980, margin:'20px auto', padding: 16 }}>
      <div className="card" style={{ padding:12, marginBottom: 12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div className="kicker">Room</div>
          <h2 className="heading" style={{ marginTop: 0 }}>{game.code}</h2>
        </div>
        <div>
          <strong>You:</strong> {me.name} {isHost && <span>(Host)</span>} {isQM && <span>(Question Master)</span>}
        </div>
      </div>

      <div style={{ display:'flex', gap:16 }}>
        <div className="card" style={{ flex: 1, padding:12 }}>
          <h3>Players</h3>
          <ul className="list">
            {players.map(p=>(
              <li key={p.id}>
                {p.name} {p.is_qm ? '⭐' : ''} — {p.score} pts
                {isHost && !p.is_qm && (
                  <button className="btn btn-ghost" style={{ marginLeft:8 }} onClick={()=>assignQM(p)}>Make QM</button>
                )}
              </li>
            ))}
          </ul>
          {isHost && (
            <div style={{ marginTop:8 }}>
              <label>Questions per QM:&nbsp;</label>
              <select className="select" value={game.num_questions} onChange={e=>setNumQuestions(parseInt(e.target.value))}>
                {[3,5,7,10,12].map(n=> <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
          {isQM && (
            <div style={{ marginTop:12, display:'flex', gap:8 }}>
              <button className="btn btn-danger" onClick={endGameNow}>End Game</button>
            </div>
          )}
        </div>

        <div className="card" style={{ flex: 2, padding:12 }}>
          {!round && (
            <div>
              {isQM ? (
                <button className="btn btn-primary" onClick={startOrNextRound}>Start Round</button>
              ) : (
                <div className="kicker">Waiting for Question Master to start…</div>
              )}
            </div>
          )}

          {round && (
            <div>
              <div className="kicker">Round {round.round_number}</div>
              <h2 className="heading" style={{ marginTop: 4 }}>{round.question || '...'}</h2>

              {round.status === 'reviewing' && isQM && (
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button className="btn btn-primary" onClick={approveQuestion}>Approve</button>
                  <button className="btn" onClick={skipQuestion}>Skip</button>
                </div>
              )}

              {round.status === 'answering' && (
                <AnswerBox roundId={round.id} playerId={playerId} onSubmit={submitMyAnswer} answers={answers.filter(a=>a.round_id===round.id)} players={players} />
              )}

              {round.status !== 'answering' && round.status !== 'reviewing' && (
                <div>
                  <h3>Answers</h3>
                  <ul className="list">
                    {answers.filter(a=>a.round_id===round.id).map(a=>{
                      const p = players.find(x=>x.id===a.player_id)!
                      return <li key={a.id}>
                        <strong>{p.name}:</strong> {a.revealed ? (a.answer_text || <em>(blank)</em>) : <em>hidden</em>}
                        {isQM && round.status !== 'scoring' && (
                          <span style={{ marginLeft:8 }}>
                            <label><input type="checkbox" checked={a.is_correct===true} onChange={e=>markCorrect(p.id, e.target.checked)} /> correct</label>
                          </span>
                        )}
                      </li>
                    })}
                  </ul>
                </div>
              )}

              {isQM && round.status === 'answering' && (
                <div style={{ marginTop:8 }}>
                  <button className="btn btn-accent" onClick={async ()=>{
                    const notDone = answers.filter(a=>a.round_id===round.id && !a.done)
                    if (notDone.length===0) await revealAnswers()
                    else alert('Everyone has not clicked Done yet!')
                  }}>Reveal</button>
                </div>
              )}

              {isQM && round.status === 'reveal' && (
                <div style={{ marginTop:8 }}>
                  <button className="btn btn-primary" onClick={submitScores}>Submit Scores</button>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AnswerBox({ roundId, playerId, onSubmit, answers, players } : {
  roundId: string
  playerId: string
  onSubmit: (text:string)=>Promise<void>
  answers: Answer[]
  players: Player[]
}){
  const mine = answers.find(a=>a.player_id===playerId)
  const [text, setText] = React.useState(mine?.answer_text || '')

  useEffect(()=>{
    setText(mine?.answer_text || '')
  }, [mine?.answer_text])

  return (
    <div>
      <div style={{ display:'flex', gap:8 }}>
        <input className="input" value={text} onChange={e=>setText(e.target.value)} placeholder="Type your answer (or leave blank)" />
        <button className="btn btn-primary" onClick={()=>onSubmit(text)} disabled={mine?.done===true}>{mine?.done ? 'Done' : 'Submit / Done'}</button>
      </div>

      <div style={{ marginTop:10, fontSize:13, color:'#666' }}>
        <strong>Done status:</strong>
        <ul className="list">
          {players.map(p=>{
            const a = answers.find(x=>x.player_id===p.id)
            return <li key={p.id}>{p.name}: {a?.done ? '✅' : '⏳'}</li>
          })}
        </ul>
      </div>
    </div>
  )
}
