import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Shown after the user clicks the recovery link in the email. */
export default function NewPassword() {
  const { updatePassword, user } = useAuth()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (pw.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (pw !== pw2) return setError('Las contraseñas no coinciden')
    setSaving(true)
    const { error: err } = await updatePassword(pw)
    setSaving(false)
    if (err) return setError('No se pudo cambiar la contraseña. Pide un nuevo enlace e inténtalo de nuevo.')
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center mb-2">Nueva contraseña</h1>
        <p className="text-stone-500 text-center text-base mb-8">
          {user?.email ? <>Para <span className="font-medium text-stone-700">{user.email}</span></> : 'Elige tu nueva contraseña'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="pw">Nueva contraseña</label>
            <input
              id="pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              autoFocus
              autoComplete="new-password"
              className="field-input"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="pw2">Repetir contraseña</label>
            <input
              id="pw2"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              autoComplete="new-password"
              className="field-input"
            />
          </div>

          {error && <p className="text-rose-600 text-base">{error}</p>}

          <button type="submit" disabled={saving} className="btn btn--primary w-full">
            {saving ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
