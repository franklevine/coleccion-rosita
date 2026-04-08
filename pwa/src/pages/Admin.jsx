import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

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
  const [exporting, setExporting] = useState(false)

  async function exportCsv() {
    setExporting(true)
    const { data } = await supabase.from('pieces_with_details').select('*')

    if (data) {
      const headers = ['title', 'artist_name', 'year_created', 'medium', 'type_of_art', 'dimensions', 'location', 'status', 'latest_value_usd', 'data_completeness']
      const csv = [
        headers.join(','),
        ...data.map((row) =>
          headers.map((h) => {
            const val = row[h] ?? ''
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
          }).join(',')
        ),
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `coleccion-rosita-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    setExporting(false)
  }

  return (
    <div>
      <p className="text-sm text-stone-500 mb-3">
        Exportar datos de la colección para respaldo o documentación.
      </p>
      <button
        onClick={exportCsv}
        disabled={exporting}
        className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50"
      >
        {exporting ? 'Exportando...' : 'Descargar CSV'}
      </button>
    </div>
  )
}
