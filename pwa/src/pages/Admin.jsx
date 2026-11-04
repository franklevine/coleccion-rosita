import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { exportBackup } from '../lib/exportBackup'

export default function Admin() {
  const { role } = useAuth()
  const [tab, setTab] = useState('heatmap')

  if (role !== 'admin') {
    return <p className="text-center text-stone-400 py-12">Acceso restringido a administradores</p>
  }

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">Administración</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-stone-200">
        {[
          { key: 'heatmap', label: 'Mapa de Deseos' },
          { key: 'export', label: 'Exportar' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm border-b-2 transition-colors ${
              tab === t.key
                ? 'border-stone-800 text-stone-800 font-medium'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'heatmap' && <WishlistHeatmap />}
      {tab === 'export' && <ExportPanel />}
    </div>
  )
}

function WishlistHeatmap() {
  const [data, setData] = useState({ pieces: [], users: [], wishlists: [] })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, contested, uncontested

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: wishlists }, { data: pieces }, { data: users }] = await Promise.all([
      supabase.from('wishlists').select('*'),
      supabase.from('pieces').select('id, title').order('title'),
      supabase.rpc('get_users_list').catch(() => ({ data: null })),
    ])

    // Get unique user IDs from wishlists if rpc not available
    let userList = users || []
    if (!users && wishlists) {
      const uniqueUsers = [...new Set(wishlists.map((w) => w.user_id))]
      userList = uniqueUsers.map((id) => ({ id, email: id.slice(0, 8) + '...' }))
    }

    setData({
      pieces: pieces || [],
      users: userList,
      wishlists: wishlists || [],
    })
    setLoading(false)
  }

  if (loading) return <p className="text-center text-stone-400 py-8">Cargando...</p>

  // Build heatmap: only pieces that someone wants
  const piecesWithInterest = data.pieces.filter((p) =>
    data.wishlists.some((w) => w.piece_id === p.id)
  )

  const contested = piecesWithInterest.filter((p) => {
    const interests = data.wishlists.filter((w) => w.piece_id === p.id && w.interest_level >= 2)
    return interests.length >= 2
  })

  const displayed = filter === 'contested'
    ? contested
    : filter === 'uncontested'
    ? piecesWithInterest.filter((p) => !contested.find((c) => c.id === p.id))
    : piecesWithInterest

  return (
    <div>
      <div className="flex gap-2 mb-3 text-xs">
        {[
          { key: 'all', label: `Todos (${piecesWithInterest.length})` },
          { key: 'contested', label: `Disputados (${contested.length})` },
          { key: 'uncontested', label: `Sin disputa (${piecesWithInterest.length - contested.length})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2 py-1 rounded ${
              filter === f.key ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-stone-400 py-4">No hay obras con interés marcado</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 border-b border-stone-200 text-stone-400">Obra</th>
                {data.users.map((u) => (
                  <th key={u.id} className="p-2 border-b border-stone-200 text-stone-400 text-center">
                    {u.email?.split('@')[0] || u.id.slice(0, 6)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((piece) => (
                <tr key={piece.id}>
                  <td className="p-2 border-b border-stone-100 text-stone-700 max-w-[150px] truncate">
                    {piece.title}
                  </td>
                  {data.users.map((u) => {
                    const wish = data.wishlists.find(
                      (w) => w.piece_id === piece.id && w.user_id === u.id
                    )
                    return (
                      <td key={u.id} className="p-2 border-b border-stone-100 text-center">
                        {wish ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                            wish.interest_level === 3 ? 'bg-red-100 text-red-700' :
                            wish.interest_level === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {wish.interest_level}
                          </span>
                        ) : (
                          <span className="text-stone-200">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ExportPanel() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function runBackup() {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const r = await exportBackup({ onProgress: setProgress })
      setResult(r)
    } catch (e) {
      setError(e.message || 'Error al generar el respaldo')
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const pct = progress
    ? progress.stage === 'zip'
      ? Math.round(progress.done * 100)
      : progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
    : 0

  const fmtMb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`

  return (
    <div className="card">
      <h3 className="text-xl font-semibold text-stone-900 mb-1">Respaldo completo</h3>
      <p className="text-base text-stone-500 mb-5">
        Descarga un archivo <span className="font-mono">.zip</span> con toda la base de datos
        (JSON), una tabla de obras (CSV para Excel) y todas las fotos. Guárdalo en Google Drive
        o en tu computador.
      </p>

      <button
        onClick={runBackup}
        disabled={running}
        className="btn btn--primary w-full sm:w-auto"
      >
        {running ? 'Generando respaldo…' : '⬇ Descargar respaldo (.zip)'}
      </button>

      {progress && (
        <div className="mt-5">
          <div className="flex justify-between text-base text-stone-600 mb-1.5">
            <span>{progress.message}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-stone-800 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-base text-emerald-900">
          <p className="font-semibold">Respaldo listo ✓</p>
          <p className="mt-1">
            {result.fileName} · {fmtMb(result.bytes)} · {result.pieces} obras · {result.photos} fotos
            {result.failedPhotos > 0 && <span className="text-rose-700"> · {result.failedPhotos} fotos no se pudieron descargar (ver LEEME.txt)</span>}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-base text-rose-800">
          {error}
        </div>
      )}

      <p className="mt-6 text-sm text-stone-400">
        Contenido: <span className="font-mono">datos/respaldo.json</span>, <span className="font-mono">datos/obras.csv</span>, <span className="font-mono">fotos/</span>, <span className="font-mono">LEEME.txt</span>.
        Las fotos en alta resolución siguen en Google Drive.
      </p>
    </div>
  )
}
