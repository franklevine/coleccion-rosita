import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, resetPassword } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'forgot' | 'sent'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const inputClass = 'w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent'

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : 'Error al iniciar sesión')
    }
    setLoading(false)
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await resetPassword(email)
    setLoading(false)
    if (err) {
      setError(err.status === 429
        ? 'Demasiados intentos. Espera unos minutos y vuelve a intentar.'
        : 'No se pudo enviar el correo. Revisa el email e inténtalo de nuevo.')
      return
    }
    setMode('sent')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center mb-2">
          Colección Rosita Lira
        </h1>
        <p className="text-stone-500 text-center text-sm mb-8">
          Catálogo familiar de arte
        </p>

        {mode === 'sent' && (
          <div className="text-center space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
              <p className="font-semibold">Correo enviado ✓</p>
              <p className="text-sm mt-1">
                Revisa <span className="font-medium">{email}</span> y haz clic en el enlace para elegir una nueva contraseña.
                Si no llega en unos minutos, revisa la carpeta de spam.
              </p>
            </div>
            <button type="button" onClick={() => setMode('login')} className="text-sm text-stone-500 hover:text-stone-800 underline">
              Volver a ingresar
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-sm text-stone-600">
              Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
            </p>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                className={inputClass}
                placeholder="correo@ejemplo.com"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-stone-800 text-white rounded-lg font-medium hover:bg-stone-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(null) }} className="w-full text-sm text-stone-500 hover:text-stone-800">
              Cancelar
            </button>
          </form>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-stone-800 text-white rounded-lg font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null) }}
              className="w-full text-sm text-stone-500 hover:text-stone-800"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
