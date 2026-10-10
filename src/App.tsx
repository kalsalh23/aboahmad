import { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Spinner } from './components/ui'
import Layout from './components/Layout'
import type { PermissionKey } from './context/AuthContext'
import { getSplashSeen } from './context/AuthContext'
import SplashScreen from './pages/SplashScreen'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ReceiveResources from './pages/ReceiveResources'
import DeliverResources from './pages/DeliverResources'
import Inventory from './pages/Inventory'
import Reports from './pages/Reports'
import ManageResources from './pages/ManageResources'
import UsersPage from './pages/Users'
import AuditPage from './pages/Audit'
import Settings from './pages/Settings'

function ProtectedRoute({ children, permission }: { children: React.ReactNode; permission?: PermissionKey }) {
  const { session, loading, can } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f1]">
        <Spinner label="جارٍ التحقق من الجلسة..." />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }

  if (permission && !can(permission)) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <h1 className="text-lg font-bold text-[#6b1f2a]">لا تملك صلاحية الوصول</h1>
          <p className="max-w-sm text-sm text-gray-500">
            هذه الصفحة تتطلب صلاحية لا يملكها حسابك. تواصل مع مدير النظام إذا كنت بحاجة إلى الوصول.
          </p>
        </div>
      </Layout>
    )
  }

  return <>{children}</>
}

function AppRoutes() {
  const { session, loading } = useAuth()
  const showSplash = !getSplashSeen()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f1]">
        <Spinner label="جارٍ تحميل النظام..." />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          showSplash ? (
            <SplashScreen onDone={() => window.location.replace(session ? '/app' : '/login')} durationMs={2800} />
          ) : session ? (
            <Navigate to="/app" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/login" element={session ? <Navigate to="/app" replace /> : <Login />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route
          path="receive"
          element={
            <ProtectedRoute permission="receipt.create">
              <ReceiveResources />
            </ProtectedRoute>
          }
        />
        <Route
          path="deliver"
          element={
            <ProtectedRoute permission="delivery.create">
              <DeliverResources />
            </ProtectedRoute>
          }
        />
        <Route
          path="stock"
          element={
            <ProtectedRoute permission="stock.view">
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute permission="reports.view">
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="manage"
          element={
            <ProtectedRoute permission="resources.manage">
              <ManageResources />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute permission="users.manage">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit"
          element={
            <ProtectedRoute permission="audit.view">
              <AuditPage />
            </ProtectedRoute>
          }
        />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <AppRoutes />
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
