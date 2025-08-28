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
          <div className="toolbar">
            <div>
              <strong>Room:</strong> <span className="badge">{roomCode}</span>
              <span className="muted"> &nbsp;|&nbsp; {name}{isHost ? ' (Host)' : ''}</span>
            </div>
            <button className="secondary" onClick={handleLeave}>Leave</button>
          </div>
          <GameRoom roomCode={roomCode} playerName={name} isHost={isHost} />
        </>
      )}
    </div>
  );
}
