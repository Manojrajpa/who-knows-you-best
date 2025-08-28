// src/App.tsx
import React, { useState } from 'react';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

export default function App() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);

  function handleEnterRoom(code: string, playerName: string, host: boolean) {
    setRoomCode(code);
    setName(playerName);
    setIsHost(host);
  }

  function handleLeave() {
    setRoomCode(null);
    setName('');
    setIsHost(false);
  }

  return (
    <div className="container">
      {!roomCode ? (
        <Lobby onEnterRoom={handleEnterRoom} />
      ) : (
        <>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <strong>Room:</strong> <span className="badge">{roomCode}</span>
            </div>
            <div className="row">
              <span style={{ marginRight: 12 }}>{name}{isHost ? ' (Host)' : ''}</span>
              <button className="secondary" onClick={handleLeave}>Leave</button>
            </div>
          </div>
          <GameRoom roomCode={roomCode} playerName={name} isHost={isHost} />
        </>
      )}
    </div>
  );
}