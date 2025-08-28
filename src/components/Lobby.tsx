import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { createRoom, joinRoom } from '../lib/roomAPI';

type Props = {
  onEnterRoom?: (code: string, name: string, isHost: boolean) => void;
};

export default function Lobby({ onEnterRoom }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string>('');

  async function host() {
    setErr('');
    if (!name.trim()) return setErr('Enter your name');
    try {
      const roomCode = nanoid(6).toUpperCase();
      const seed = Math.floor(Math.random() * 1e9);
      await createRoom(roomCode, seed);
      if (typeof onEnterRoom === 'function') onEnterRoom(roomCode, name.trim(), true);
    } catch (e: any) {
      setErr(e.message || 'Failed to host');
    }
  }

  async function join() {
    setErr('');
    if (!name.trim()) return setErr('Enter your name');
    if (!code.trim()) return setErr('Enter a code');
    try {
      await joinRoom(code.trim().toUpperCase(), name.trim());
      if (typeof onEnterRoom === 'function') onEnterRoom(code.trim().toUpperCase(), name.trim(), false);
    } catch (e: any) {
      setErr(e.message || 'Failed to join');
    }
  }

  return (
    <div className="card" style={{maxWidth: 640, margin: '64px auto'}}>
      <h1 style={{marginTop: 0}}>Who Knows You Better?</h1>
      <p>Host a room or join with a code.</p>
      <div className="row" style={{gap:12}}>
        <label style={{minWidth: 110}}>Display name</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" />
      </div>
      <div className="row" style={{gap:12, marginTop: 12}}>
        <button onClick={host}>Host Game</button>
        <input
          placeholder="Enter code"
          value={code}
          onChange={e=>setCode(e.target.value.toUpperCase())}
        />
        <button className="secondary" onClick={join}>Join</button>
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
