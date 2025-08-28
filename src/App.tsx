import React, { useState } from 'react';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

export default function App() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);

  function onEnterRoom(code: string, name: string, host: boolean) {
    setRoomCode(code);
    setPlayerName(name);
    setIsHost(host);
  }

  function onLeave() {
    setRoomCode(null);
    setPlayerName('');
    setIsHost(false);
  }

  return (
    <div>
      {!roomCode ? (
        <Lobby onEnterRoom={onEnterRoom} />
      ) : (
        <GameRoom roomCode={roomCode} playerName={playerName} isHost={isHost} onLeave={onLeave} />
      )}
    </div>
  );
}
