import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Eye, EyeOff, LogIn, Lock, User } from 'lucide-react'
import { BRAND, COLORS } from '../config/brand'
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
  const identifierRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    identifierRef.current?.focus()
    if (profile) navigate('/app', { replace: true })
  }, [profile, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)

    if (!identifier.trim()) return setError('الرجاء إدخال رقم الهاتف أو اسم المستخدم')
    if (!password) return setError('الرجاء إدخال كلمة المرور')

    setLoading(true)
    const res = await api.auth.login(identifier.trim(), password)
    setLoading(false)

    if (res.error || !res.data) {
      setError(res.error ?? 'تعذر تسجيل الدخول')
      setPassword('')
      return
    }
    navigate('/app', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f6f1] p-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: COLORS.primary }} aria-hidden>
            <Package className="h-7 w-7 text-white" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#002623]">{BRAND.appNameShort}</h1>
            <p className="mt-1 text-xs text-gray-500">سجّل الدخول للمتابعة إلى النظام</p>
          </div>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4 p-5" noValidate>
            {error && (
              <Alert tone="danger" title="تعذر تسجيل الدخول">
                {error}
              </Alert>
            )}

            <Input
              ref={identifierRef}
              label="رقم الهاتف أو اسم المستخدم"
              name="identifier"
              placeholder="مثال: 0500000000"
              autoComplete="username"
              inputMode="text"
              dir="ltr"
              icon={<User className="h-4 w-4" />}
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
                icon={<Lock className="h-4 w-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                aria-pressed={showPassword}
                className="absolute end-3 top-[34px] rounded p-1 text-gray-400 hover:text-gray-700"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button type="submit" block size="lg" loading={loading}>
              {!loading && <LogIn className="h-4 w-4" aria-hidden />}
              {loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>

            <p className="text-center text-[11px] text-gray-400">الدخول مخصص لموظفي المستودع المصرح لهم فقط</p>
          </form>
        </Card>

        <p className="mt-6 text-center text-[10px] text-gray-400">
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