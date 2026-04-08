import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Gallery from './pages/Gallery'
import PieceDetail from './pages/PieceDetail'
import Pricing from './pages/Pricing'
import Artists from './pages/Artists'
import Wishlist from './pages/Wishlist'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <div className="min-h-screen flex items-center justify-center text-stone-400">Cargando...</div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Gallery />} />
        <Route path="obra/:id" element={<PieceDetail />} />
        <Route path="precios" element={<Pricing />} />
        <Route path="artistas" element={<Artists />} />
        <Route path="favoritos" element={<Wishlist />} />
        <Route path="resumen" element={<Dashboard />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/coleccion-rosita">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
