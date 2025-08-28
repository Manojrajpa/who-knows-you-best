import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import * as Q from '../questions';

type Props = {
  roomCode: string;         // e.g. "AB12CD"
  playerName: string;       // local display name
  isHost: boolean;          // host flag
  onLeave?: () => void;
};

type RoomRow = {
  code: string;
  created_at: number;
  started: boolean;
  seed: number;
};

type PlayerRow = {
  id?: string;
  code: string;
  name: string;
  joined_at?: number;
};

// questions (support default / QUESTIONS / questions)
const Q_ANY: any = (Q as any).QUESTIONS ?? (Q as any).default ?? (Q as any).questions ?? [];
const QUESTIONS: string[] = Array.isArray(Q_ANY) ? Q_ANY : [];

/** Fisher–Yates with seed */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  let s = seed >>> 0;
  const rnd = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function fetchRoom(code: string): Promise<RoomRow | null> {
  const { data, error } = await supabase.from('rooms').select('*').eq('code', code).single();
  if (error && (error as any).code !== 'PGRST116') throw error;
  return data as any;
}

async function listPlayers(code: string): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, code, name, joined_at')
    .eq('code', code)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data as any) || [];
}

async function setStarted(code: string, started: boolean) {
  const { error } = await supabase.from('rooms').update({ started }).eq('code', code);
  if (error) throw error;
}

async function resetForReplay(code: string) {
  // new seed forces a fresh question order; back to lobby
  const newSeed = Math.floor(Math.random() * 1e9);
  const { error } = await supabase.from('rooms').update({ started: false, seed: newSeed }).eq('code', code);
  if (error) throw error;
}

export default function GameRoom({ roomCode, playerName, isHost, onLeave }: Props) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [qIndex, setQIndex] = useState(0);       // local question pointer (host drives)
  const [approved, setApproved] = useState(false);
  const [skipped, setSkipped] = useState(false);

  // Build a deterministic order from seed (no repeats within the session)
  const order = useMemo(() => {
    if (!QUESTIONS.length) return [] as number[];
    const idx = QUESTIONS.map((_, i) => i);
    const seed = room?.seed ?? 1;
    return seededShuffle(idx, seed);
  }, [room?.seed]);

  const currentQuestion =
    order.length && qIndex >= 0 && qIndex < order.length ? QUESTIONS[order[qIndex]] : '';

  /** Initial + polling */
  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const [r, p] = await Promise.all([fetchRoom(roomCode), listPlayers(roomCode)]);
        if (!alive) return;
        setRoom(r);
        setPlayers(p);
      } catch (e: any) {
        if (alive) setErr(e.message || 'Failed to sync');
      }
    };

    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [roomCode]);

  /** Manual refresh */
  async function handleRefresh() {
    try {
      const [r, p] = await Promise.all([fetchRoom(roomCode), listPlayers(roomCode)]);
      setRoom(r);
      setPlayers(p);
      setInfo('Synced'); setTimeout(() => setInfo(''), 900);
    } catch {/* ignore */}
  }

  /** Start Game (host) */
  async function handleStart() {
    if (!room) return;
    if (!QUESTIONS.length) {
      setErr('No questions found in src/questions.ts');
      return;
    }
    try {
      await setStarted(room.code, true);
      setApproved(false); setSkipped(false);
      setQIndex(0);
      setRoom({ ...room, started: true });
      setInfo('Game started');
    } catch (e: any) {
      setErr(e.message || 'Failed to start');
    }
  }

  /** Play Again -> back to lobby + new seed, clear local round state */
  async function handlePlayAgain() {
    if (!room) return;
    try {
      await resetForReplay(room.code);
      setApproved(false); setSkipped(false);
      setQIndex(0);
      setRoom({ ...room, started: false, seed: (room.seed || 0) + 1 });
      setInfo('Ready for a new game. Press Start Game.');
    } catch (e: any) {
      setErr(e.message || 'Failed to reset');
    }
  }

  /** Approve / Skip (host) */
  function handleApprove() {
    if (!room?.started || !currentQuestion) return;
    setApproved(true); setSkipped(false);
  }
  function handleSkip() {
    if (!room?.started || !currentQuestion) return;
    setSkipped(true); setApproved(false);
  }

  /** Next Question (host) */
  function handleNext() {
    if (!room?.started) return;
    if (!order.length) return;
    const next = Math.min(order.length - 1, qIndex + 1);
    setQIndex(next);
    setApproved(false); setSkipped(false);
  }

  const isLobby = !room?.started;
  const hostControlsDisabled = !room?.started || !currentQuestion;

  return (
    <div style={{ maxWidth: 960, margin: '24px auto', padding: '0 12px' }}>
      {/* Header row */}
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          Room: <span className="badge">{roomCode}</span> &nbsp;|&nbsp; {playerName}{isHost ? ' (Host)' : ''}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="secondary" onClick={handleRefresh}>Refresh</button>
          {onLeave && <button className="secondary" onClick={onLeave}>Leave</button>}
        </div>
      </div>

      {/* Players */}
      <div className="card">
        <strong>Players</strong>
        <div className="list" style={{ marginTop: 8 }}>
          {players.map((p) => (
            <span className="badge" key={p.id ?? p.name}>{p.name}</span>
          ))}
          {!players.length && <span className="muted">Waiting for players…</span>}
        </div>
      </div>

      {/* Lobby controls */}
      {isLobby && isHost && (
        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={handleStart}>Start Game</button>
          <button className="secondary" onClick={handlePlayAgain}>Play Again</button>
        </div>
      )}

      {/* Question block */}
      {!isLobby && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ margin: 0, minHeight: 60 }}>
            {currentQuestion || 'Waiting for the next question…'}
          </h2>

          {isHost && (
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button
                className="secondary"
                onClick={handleApprove}
                disabled={hostControlsDisabled}
              >
                Approve
              </button>
              <button
                className="secondary"
                onClick={handleSkip}
                disabled={hostControlsDisabled}
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                disabled={!order.length || qIndex >= order.length - 1}
              >
                Next Question
              </button>
              <span className="small" style={{ marginLeft: 'auto' }}>
                Q {order.length ? qIndex + 1 : 0} / {order.length || 0}
                {approved ? ' — Approved' : skipped ? ' — Skipped' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {info && <p className="success" style={{ textAlign: 'center' }}>{info}</p>}
      {err && <p className="error" style={{ textAlign: 'center' }}>{err}</p>}
    </div>
  );
}