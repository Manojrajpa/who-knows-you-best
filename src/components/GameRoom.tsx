import React, { useEffect, useState } from 'react';

// Robust import that works whether questions.ts uses default export or named export
import * as Q from '../questions';
const QUESTIONS: string[] = (Q as any).QUESTIONS || (Q as any).default || (Q as any).questions;

import { buildQuestionOrder } from '../lib/questionsOrder';
import { fetchRoom, listPlayers, markGameStarted, resetRoomForReplay } from '../lib/roomAPI';

type Props = {
  roomCode: string;
  playerName: string;
  isHost: boolean;
};

export default function GameRoom({ roomCode, playerName, isHost }: Props) {
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const r = await fetchRoom(roomCode);
        setRoom(r);
        setStarted(!!r.started);
        setOrder(buildQuestionOrder(r.seed, QUESTIONS.length, 10));
      } catch (e: any) {
        setError(e.message || 'Failed to load room');
      }
    })();
  }, [roomCode]);

  // Polling fallback so other devices stay in sync
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetchRoom(roomCode);
        const p = await listPlayers(roomCode);
        if (!alive) return;
        setRoom(r);
        setStarted(!!r.started);
        setPlayers(p);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, [roomCode]);

  // Manual Refresh
  async function handleRefresh() {
    try {
      const r = await fetchRoom(roomCode);
      const p = await listPlayers(roomCode);
      setRoom(r);
      setStarted(!!r.started);
      setPlayers(p);
      setInfo('Synced');
      setTimeout(() => setInfo(''), 800);
    } catch {}
  }

  async function handleStart() {
    try {
      await markGameStarted(roomCode, true);
      setStarted(true);
      setIdx(0);
      setInfo('Game started');
    } catch (e: any) {
      setError(e.message || 'Failed to start');
    }
  }

  async function handlePlayAgain() {
    try {
      const newSeed = Math.floor(Math.random() * 1e9);
      await resetRoomForReplay(roomCode, newSeed);
      const r = await fetchRoom(roomCode);
      setRoom(r);
      setStarted(false);
      setOrder(buildQuestionOrder(r.seed, QUESTIONS.length, 10));
      setIdx(0);
      setInfo('New game ready. Press Start Game');
    } catch (e: any) {
      setError(e.message || 'Failed to reset');
    }
  }

  const question = order.length ? QUESTIONS[order[idx]] : '';

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>Room: <span className="badge">{roomCode}</span></div>
          <div className="row">
            <button className="secondary" onClick={handleRefresh}>Refresh</button>
          </div>
        </div>
      </div>

      <div className="card">
        <strong>Players</strong>
        <div className="list">
          {players.map((p: any) => (
            <span className="badge" key={p.id || p.name}>{p.name}</span>
          ))}
        </div>
      </div>

      {!started && isHost && (
        <div className="row">
          <button onClick={handleStart}>Start Game</button>
          <button className="secondary" onClick={handlePlayAgain}>Play Again</button>
        </div>
      )}

      {started && (
        <div className="card">
          <div style={{ minHeight: 60 }}>
            <h3 style={{ margin: 0 }}>{question}</h3>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button
              className="secondary"
              onClick={() => setIdx(i => Math.max(0, i - 1))}
              disabled={idx <= 0}
            >Prev</button>
            <span className="small">Q {order.length ? idx + 1 : 0} / {order.length}</span>
            <button
              onClick={() => setIdx(i => Math.min(order.length - 1, i + 1))}
              disabled={idx >= order.length - 1}
            >Next</button>
          </div>
          {isHost && (
            <div className="row">
              <button className="secondary" onClick={handlePlayAgain}>Play Again</button>
            </div>
          )}
        </div>
      )}

      {info && <p className="success" style={{ textAlign: 'center' }}>{info}</p>}
      {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}
    </div>
  );
}