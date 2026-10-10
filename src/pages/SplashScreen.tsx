import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import { BRAND, COLORS } from '../config/brand'
import { setSplashSeen } from '../context/AuthContext'

export default function SplashScreen({ onDone, durationMs }: { onDone: () => void; durationMs?: number }) {
  const [fade, setFade] = useState(false)
  const duration = durationMs ?? BRAND.splashDurationMs

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    setSplashSeen()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    const fadeAt = reduce ? Math.max(0, duration - 300) : duration - 500
    const fadeTimer = window.setTimeout(() => setFade(true), fadeAt)
    const doneTimer = window.setTimeout(() => {
      document.body.style.overflow = ''
      onDone()
    }, duration)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(doneTimer)
      document.body.style.overflow = ''
    }
  }, [duration, onDone])

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${fade ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: `linear-gradient(180deg, ${COLORS.primaryDarker} 0%, ${COLORS.primaryDark} 100%)`, transition: reduce ? 'none' : 'opacity 500ms ease' }}
      role="img"
      aria-label={BRAND.appName}
    >
      <div className={`flex flex-col items-center gap-5 ${reduce ? '' : 'animate-fade-in'}`}>
        <span className={`flex h-24 w-24 items-center justify-center rounded-3xl bg-white/10 ring-1 ring-white/25 ${reduce ? '' : 'animate-slide-in'}`}>
          <Package className="h-12 w-12" style={{ color: COLORS.goldLight }} aria-hidden />
        </span>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{BRAND.appName}</h1>
          <p className="text-sm" style={{ color: COLORS.goldLight }}>
            {BRAND.appTagline}
          </p>
        </div>
      </div>
      <p className="absolute bottom-8 text-[11px] text-white/40">{BRAND.organization}</p>
    </div>
  )
}