import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import * as Q from '../questions';

type Props = {
  roomCode: string;      // e.g. “ABCD12”
  playerName: string;    // local display name
  isHost: boolean;       // true if this client is the host/QM
  onLeave?: () => void;
};

type GameRow = {
  id: string;
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  qm_id: string | null;
  host_id: string | null;
  num_questions: number | null;
  started_at: string | null;
  created_at: string;
};

type PlayerRow = {
  id: string;
  game_id: string;
  name: string;
  is_host: boolean;
  is_qm: boolean;
  score: number | null;
  joined_at: string;
};

type RoundRow = {
  id: string;
  game_id: string;
  round_number: number | null;
  question: string | null;
  status: 'pending' | 'approved' | 'skipped' | 'ended' | null;
  created_at: string;
};

// questions array (supports default export or named QUESTIONS/questions)
const QUESTIONS_ANY: any =
  (Q as any).QUESTIONS ?? (Q as any).default ?? (Q as any).questions ?? [];
const QUESTION_BANK: string[] = Array.isArray(QUESTIONS_ANY) ? QUESTIONS_ANY : [];

/** -------- Supabase helpers -------- */
async function fetchGameByCode(code: string): Promise<GameRow | null> {
  const { data, error } = await supabase.from('games').select('*').eq('code', code).single();
  if (error && (error as any).code !== 'PGRST116') throw error;
  return data as any;
}

async function fetchPlayers(gameId: string): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data as any) || [];
}

async function fetchActiveRound(gameId: string): Promise<RoundRow | null> {
  // Most recent round that is not 'ended'
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('game_id', gameId)
    .not('status', 'eq', 'ended')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length ? (data[0] as any) : null;
}

async function createNextRound(gameId: string, used: Set<string>): Promise<RoundRow> {
  const pool = QUESTION_BANK.filter((q) => !used.has(q));
  const pickFrom = pool.length ? pool : QUESTION_BANK;
  const q = pickFrom[Math.floor(Math.random() * pickFrom.length)];

  const { data, error } = await supabase
    .from('rounds')
    .insert({ game_id: gameId, question: q, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data as any;
}

/** -------- Component -------- */
export default function GameRoom({ roomCode, playerName, isHost, onLeave }: Props) {
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [round, setRound] = useState<RoundRow | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const gameId = game?.id;

  /** Initial load + polling (keeps both devices in sync) */
  useEffect(() => {
    let alive = true;

    const loadAll = async () => {
      try {
        const g = await fetchGameByCode(roomCode);
        if (!alive) return;
        setGame(g);
        if (g) {
          const [p, r] = await Promise.all([fetchPlayers(g.id), fetchActiveRound(g.id)]);
          if (!alive) return;
          setPlayers(p);
          setRound(r);
        } else {
          setPlayers([]);
          setRound(null);
        }
      } catch (e: any) {
        if (alive) setError(e.message || 'Failed to load game');
      }
    };

    loadAll();
    const t = setInterval(loadAll, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [roomCode]);

  /** Manual refresh */
  async function handleRefresh() {
    try {
      if (!gameId) return;
      const [g, p, r] = await Promise.all([
        fetchGameByCode(roomCode),
        fetchPlayers(gameId),
        fetchActiveRound(gameId),
      ]);
      setGame(g);
      setPlayers(p);
      setRound(r);
      setInfo('Synced'); setTimeout(() => setInfo(''), 900);
    } catch {
      // ignore
    }
  }

  /** Start Game (host only) */
  async function handleStart() {
    try {
      if (!game) return;
      if (!QUESTION_BANK.length) {
        setError('No questions found in src/questions.ts');
        return;
      }
      // mark game playing
      const { error: uerr } = await supabase.from('games').update({ status: 'playing' }).eq('id', game.id);
      if (uerr) throw uerr;

      // avoid repeats across the whole game
      const { data: prev } = await supabase
        .from('rounds')
        .select('question')
        .eq('game_id', game.id);
      const used = new Set((prev || []).map((r: any) => r.question as string));

      const r = await createNextRound(game.id, used);
      setGame({ ...game, status: 'playing' });
      setRound(r);
      setInfo('Game started');
    } catch (e: any) {
      setError(e.message || 'Failed to start');
    }
  }

  /** Approve / Skip (host only; disabled if no active round) */
  async function handleApprove() {
    if (!game || !round) return;
    try {
      const { error: uerr } = await supabase.from('rounds').update({ status: 'approved' }).eq('id', round.id);
      if (uerr) throw uerr;
      setRound({ ...round, status: 'approved' });
    } catch (e: any) {
      setError(e.message || 'Approve failed');
    }
  }
  async function handleSkip() {
    if (!game || !round) return;
    try {
      const { error: uerr } = await supabase.from('rounds').update({ status: 'skipped' }).eq('id', round.id);
      if (uerr) throw uerr;
      setRound({ ...round, status: 'skipped' });
    } catch (e: any) {
      setError(e.message || 'Skip failed');
    }
  }

  /** Next Question (host only) */
  async function handleNextQuestion() {
    if (!game) return;
    try {
      const { data: prev } = await supabase
        .from('rounds')
        .select('question')
        .eq('game_id', game.id);
      const used = new Set((prev || []).map((r: any) => r.question as string));
      const r = await createNextRound(game.id, used);
      setRound(r);
    } catch (e: any) {
      setError(e.message || 'Next question failed');
    }
  }

  /** Play Again → go back to lobby and clear local round so Start Game shows */
  async function handlePlayAgain() {
    if (!game) return;
    try {
      const { error: uerr } = await supabase.from('games').update({ status: 'lobby' }).eq('id', game.id);
      if (uerr) throw uerr;
      setGame({ ...game, status: 'lobby' });
      setRound(null); // critical: removes old question from the screen
      setInfo('Ready to start a new game');
    } catch (e: any) {
      setError(e.message || 'Play Again failed');
    }
  }

  /** Derived flags */
  const isLobby = game?.status === 'lobby';
  const hasRound = !!round;
  const question = round?.question || '';

  return (
    <div style={{ maxWidth: 960, margin: '24px auto', padding: '0 12px' }}>
      {/* Header row (Refresh + Leave on the right) */}
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
            <span className="badge" key={p.id}>{p.name}</span>
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

      {/* Question block when playing */}
      {!isLobby && (
        <div className="card" style={{ marginTop: 12 }}>
          <h2 style={{ margin: 0, minHeight: 60 }}>
            {question || 'Waiting for the next question…'}
          </h2>

          {isHost && (
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button
                className="secondary"
                onClick={handleApprove}
                disabled={!hasRound}
              >Approve</button>
              <button
                className="secondary"
                onClick={handleSkip}
                disabled={!hasRound}
              >Skip</button>
              <button
                onClick={handleNextQuestion}
                disabled={!QUESTION_BANK.length}
              >Next Question</button>
            </div>
          )}
        </div>
      )}

      {info && <p className="success" style={{ textAlign: 'center' }}>{info}</p>}
      {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}
    </div>
  );
}