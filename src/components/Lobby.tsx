import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { createRoom, joinRoom } from '../lib/roomAPI';

type Props = {
  onEnterRoom: (code: string, name: string, isHost: boolean) => void;
};

export default function Lobby({ onEnterRoom }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  async function onHost() {
    setError('');
    if (!name.trim()) return setError('Enter your name');
    const roomCode = nanoid(6).toUpperCase();
    const seed = Math.floor(Math.random() * 1e9);
    try {
      await createRoom(roomCode, seed);
      onEnterRoom(roomCode, name.trim(), true);
    } catch (e: any) {
      setError(e.message || 'Failed to host');
    }
  }

  async function onJoin() {
    setError('');
    if (!name.trim()) return setError('Enter your name');
    if (!code.trim()) return setError('Enter a code');
    try {
      await joinRoom(code.trim().toUpperCase(), name.trim());
      onEnterRoom(code.trim().toUpperCase(), name.trim(), false);
    } catch (e: any) {
      setError(e.message || 'Failed to join');
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="row">
        <button onClick={onHost}>Host Game</button>
        <input
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="secondary" onClick={onJoin}>
          Join
        </button>
      </div>
      {error && <p className="error" style={{ textAlign: 'center' }}>{error}</p>}
    </div>
  );
}
