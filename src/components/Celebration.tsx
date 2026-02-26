import React, { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

export default function Celebration({ fire = true }:{ fire?: boolean }){
  const fired = useRef(false)
  useEffect(()=>{
    if (fire && !fired.current){
      fired.current = true
      const duration = 3000
      const end = Date.now() + duration
      ;(function frame(){
        confetti({ particleCount: 3, angle: 60, spread: 60, startVelocity: 45, origin: { x: 0 } })
        confetti({ particleCount: 3, angle: 120, spread: 60, startVelocity: 45, origin: { x: 1 } })
        if (Date.now() < end) requestAnimationFrame(frame)
      })()
      setTimeout(()=> confetti({ particleCount: 160, spread: 80, scalar: 0.9 }), duration)
    }
  }, [fire])
  return null
}
