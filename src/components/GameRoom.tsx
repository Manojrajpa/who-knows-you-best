import React, { useEffect, useState } from 'react';
import * as Q from '../questions';
import { buildQuestionOrder } from '../lib/questionsOrder';
import { fetchRoom, listPlayers, markGameStarted, resetRoomForReplay } from '../lib/roomAPI';

type Props = {
  roomCode: string;
  playerName: string;
  isHost: boolean;
  onLeave?: () => void;
};

const QUESTIONS_ANY: any =
  (Q as any).QUESTIONS ?? (Q as any).default ?? (Q as any).questions ?? [];
const QUESTIONS: string[] = Array.isArray(QUESTIONS_ANY) ? QUESTIONS_ANY : [];

export default function GameRoom({ roomCode, playerName, isHost, onLeave }: Props) {
  const [started, setStarted] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // initial
  useEffect(() => {
    (async () => {
      try {
        const r = await fetchRoom(roomCode);
        setStarted(!!r.started);
        setOrder(buildQuestionOrder(r.seed, QUESTIONS.length, 10));
      } catch (e: any) {
        setErr(e.message || 'Failed to load room');
      }
    })();
  }, [roomCode]);

  // polling
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetchRoom(roomCode);
        const p = await listPlayers(roomCode);
        if (!alive) return;
        setStarted(!!r.started);
        setPlayers(p);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, [roomCode]);

  async function refresh() {
    try {
      const r = await fetchRoom(roomCode);
      const p = await listPlayers(roomCode);
      setStarted(!!r.started);
      setPlayers(p);
      setMsg('Synced'); setTimeout(()=>setMsg(''), 800);
    } catch {}
  }

  async function startGame() {
    if (!QUESTIONS.length) {
      setErr('No questions found. Check src/questions.ts export.'); return;
    }
    try {
      await markGameStarted(roomCode, true);
      setStarted(true);
      setIdx(0);
    } catch(e:any){ setErr(e.message || 'Failed to start'); }
  }

  async function playAgain() {
    try {
      const seed = Math.floor(Math.random()*1e9);
      await resetRoomForReplay(roomCode, seed);
      const r = await fetchRoom(roomCode);
      setStarted(false);
      setOrder(buildQuestionOrder(r.seed, QUESTIONS.length, 10));
      setIdx(0);
      setMsg('New game ready. Press Start Game');
    } catch(e:any){ setErr(e.message || 'Failed to reset'); }
  }

  const q = order.length && idx < order.length ? QUESTIONS[order[idx]] : '';

  return (
    <div style={{maxWidth: 960, margin: '24px auto', padding: '0 12px'}}>
      <div className="row" style={{justifyContent:'space-between', marginBottom:12}}>
        <div>Room: <span className="badge">{roomCode}</span> &nbsp;|&nbsp; {playerName}{isHost?' (Host)':''}</div>
        <div className="row" style={{gap:8}}>
          <button className="secondary" onClick={refresh}>Refresh</button>
          {onLeave && <button className="secondary" onClick={onLeave}>Leave</button>}
        </div>
      </div>

      <div className="card">
        <strong>Players</strong>
        <div className="list" style={{marginTop:8}}>
          {players.map((p:any)=> <span className="badge" key={p.id || p.name}>{p.name}</span>)}
          {!players.length && <span className="muted">Waiting for players…</span>}
        </div>
      </div>

      {!started && isHost && (
        <div className="row" style={{marginTop:12}}>
          <button onClick={startGame}>Start Game</button>
          <button className="secondary" onClick={playAgain}>Play Again</button>
        </div>
      )}

      {started && (
        <div className="card" style={{marginTop:12}}>
          <h2 style={{margin:0, minHeight:60}}>{q || 'Loading question…'}</h2>
          {isHost && (
            <div className="row" style={{justifyContent:'space-between', marginTop:12}}>
              <button className="secondary" onClick={()=>setIdx(i=>Math.max(0, i-1))} disabled={idx<=0}>Prev</button>
              <span className="small">Q {order.length ? idx+1 : 0} / {order.length || 0}</span>
              <button onClick={()=>setIdx(i=>Math.min(order.length-1, i+1))} disabled={!order.length || idx>=order.length-1}>Next</button>
            </div>
          )}
        </div>
      )}

      {msg && <p className="success" style={{textAlign:'center'}}>{msg}</p>}
      {err && <p className="error" style={{textAlign:'center'}}>{err}</p>}
    </div>
  );
}
