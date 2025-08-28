import React, { useState } from 'react'
import Lobby from './components/Lobby'
import GameRoom from './components/GameRoom'

export default function App(){
  const [ctx, setCtx] = useState<null | { gameId: string, playerId: string, isHost: boolean }>(null)
  if (!ctx) return <Lobby onEnter={setCtx} />
  return <GameRoom gameId={ctx.gameId} playerId={ctx.playerId} />
}
