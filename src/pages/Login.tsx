import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Lock, User } from 'lucide-react'
import { BRAND } from '../config/brand'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Alert, Button, Card, Input } from '../components/ui'

export default function Login() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const identifierRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    identifierRef.current?.focus()
    if (profile) navigate('/app', { replace: true })
  }, [profile, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)

    if (!identifier.trim()) {
      setError('الرجاء إدخال رقم الهاتف أو اسم المستخدم')
      identifierRef.current?.focus()
      return
    }
    if (!password) {
      setError('الرجاء إدخال كلمة المرور')
      return
    }

    setLoading(true)
    const res = await api.auth.login(identifier.trim(), password)
    setLoading(false)

    if (res.error || !res.data) {
      setError(res.error ?? 'تعذر تسجيل الدخول')
      setAttempts((n) => n + 1)
      setPassword('')
      return
    }
    navigate('/app', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f6f1] p-4">
      <div className="w-full max-w-[460px]">
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <img
            src={BRAND.logoPath}
            alt={`شعار ${BRAND.organization}`}
            width={96}
            height={96}
            className="h-24 w-24 rounded-2xl border border-[#ded9c7] bg-white object-contain p-1.5 shadow-sm"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#002623]">{BRAND.appNameShort}</h1>
            <p className="mt-1.5 text-sm text-gray-600">سجّل الدخول للمتابعة إلى النظام</p>
          </div>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-5 p-6" noValidate>
            {error && (
              <Alert tone="danger" title="تعذر تسجيل الدخول">
                {error}
              </Alert>
            )}

            {attempts >= 3 && (
              <p className="rounded-lg border border-[#e0d3b2] bg-[#fdf9ee] px-3 py-2 text-xs text-[#6d5836]">
                إذا نسيت كلمة المرور راجع مدير النظام لإعادة تعيينها.
              </p>
            )}

            <Input
              ref={identifierRef}
              label="رقم الهاتف أو اسم المستخدم"
              name="identifier"
              placeholder="0912345678"
              autoComplete="username"
              inputMode="tel"
              dir="ltr"
              inputSize="lg"
              icon={<User className="h-5 w-5" />}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
            />

            <div className="relative">
              <Input
                label="كلمة المرور"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                dir="ltr"
                inputSize="lg"
                icon={<Lock className="h-5 w-5" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                aria-pressed={showPassword}
                className="absolute end-3 top-[38px] rounded-md p-2 text-gray-500 hover:text-gray-800"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <Button type="submit" block size="lg" loading={loading} className="h-14 text-base">
              {!loading && <LogIn className="h-5 w-5" aria-hidden />}
              {loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>

            <p className="text-center text-xs text-gray-500">الدخول مخصص لموظفي المستودع المصرح لهم فقط</p>
          </form>
        </Card>

        <p className="mt-6 text-center text-[11px] text-gray-400">
          {BRAND.organization} — الإصدار {BRAND.version}
        </p>
      </div>
    </div>
  )
}

export function Unauthorized() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-bold text-[#6b1f2a]">لا تملك صلاحية الوصول</h1>
      <p className="max-w-sm text-sm text-gray-500">هذه الصفحة تتطلب صلاحية لا يملكها حسابك. تواصل مع مدير النظام إذا كنت بحاجة إلى الوصول.</p>
      <Button onClick={() => navigate('/app')}>العودة للرئيسية</Button>
    </div>
  )
}

export function SessionExpired() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f7f6f1] p-4 text-center">
      <Alert tone="warning" title="انتهت صلاحية الجلسة">
        تم تسجيل خروجك تلقائيًا. الرجاء تسجيل الدخول مرة أخرى.
      </Alert>
      <Button onClick={() => navigate('/', { replace: true })}>تسجيل الدخول</Button>
    </div>
  )
}