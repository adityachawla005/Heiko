'use client'

import { DotLottieReact } from '@lottiefiles/dotlottie-react'

export default function LottieBackground() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', height: '100%',
        filter: 'grayscale(1) brightness(0.38) contrast(1.2)',
        opacity: 0.9,
      }}>
        <DotLottieReact
          src="https://lottie.host/ea4ca5d7-7f83-4e6e-ab48-8d3fd6e4e8d2/ZTzmSxx0uS.lottie"
          loop
          autoplay
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      {/* Vignette so edges fade into the dark bg */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 20%, var(--bg) 100%)',
      }} />
    </div>
  )
}
