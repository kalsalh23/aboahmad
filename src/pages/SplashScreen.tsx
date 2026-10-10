import { useEffect, useState } from 'react'
import { BRAND, COLORS } from '../config/brand'
import { setSplashSeen } from '../context/AuthContext'

export default function SplashScreen({ onDone, durationMs }: { onDone: () => void; durationMs?: number }) {
  const [fade, setFade] = useState(false)
  const [logoOk, setLogoOk] = useState(true)
  const duration = durationMs ?? BRAND.splashDurationMs ?? 3000

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
      style={{
        background: `linear-gradient(180deg, ${COLORS.primaryDarker} 0%, ${COLORS.primaryDark} 100%)`,
        transition: reduce ? 'none' : 'opacity 500ms ease',
      }}
      role="img"
      aria-label={BRAND.appName}
    >
      <div className={`flex flex-col items-center gap-6 ${reduce ? '' : 'animate-fade-in'}`}>
        <div
          className={`flex h-32 w-32 items-center justify-center rounded-3xl bg-white shadow-xl ring-1 ring-white/30 ${reduce ? '' : 'animate-slide-in'}`}
        >
          {logoOk ? (
            <img
              src={BRAND.logoPath}
              alt={BRAND.logoAlt ?? `شعار ${BRAND.organization}`}
              width={104}
              height={104}
              onError={() => setLogoOk(false)}
              className="h-[104px] w-[104px] object-contain"
            />
          ) : (
            <FallbackMark />
          )}
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{BRAND.appName}</h1>
          <p className="text-sm" style={{ color: COLORS.goldLight }}>
            {BRAND.appTagline}
          </p>
        </div>
      </div>
      <p className="absolute bottom-8 text-[11px] text-white/50">{BRAND.organization}</p>
    </div>
  )
}

function FallbackMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-16 w-16"
      fill="none"
      stroke={COLORS.primaryDark}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 8V6a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 6v12a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 18v-2" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}
