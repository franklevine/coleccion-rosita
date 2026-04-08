import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Pricing() {
  const { user } = useAuth()
  const [pieces, setPieces] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterUnpriced, setFilterUnpriced] = useState(false)
  const [stats, setStats] = useState({ total: 0, valued: 0, totalUsd: 0 })

  useEffect(() => {
    fetchPieces()
  }, [])

  async function fetchPieces() {
    setLoading(true)
    const { data } = await supabase
      .from('pieces_with_details')
      .select('*')
      .order('title')

    if (data) {
      setPieces(data)
      const valued = data.filter((p) => p.latest_value_usd)
      setStats({
        total: data.length,
        valued: valued.length,
        totalUsd: valued.reduce((sum, p) => sum + Number(p.latest_value_usd || 0), 0),
      })
    }
    setLoading(false)
  }

  const displayed = filterUnpriced
    ? pieces.filter((p) => !p.latest_value_usd)
    : pieces

  if (loading) return <p className="text-center text-stone-400 py-12">Cargando...</p>

  return (
    <div className="px-4 py-4">
      {/* Header stats */}
      <div className="mb-4 p-3 bg-white border border-stone-200 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-stone-800">Vista de Precios</h2>
          <label className="flex items-center gap-1.5 text-xs text-stone-500">
            <input
              type="checkbox"
              checked={filterUnpriced}
              onChange={(e) => setFilterUnpriced(e.target.checked)}
            />
            Solo sin precio
          </label>
        </div>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-stone-400">Valoradas: </span>
            <span className="font-medium">{stats.valued} de {stats.total}</span>
            <span className="text-stone-400"> ({stats.total > 0 ? Math.round((stats.valued / stats.total) * 100) : 0}%)</span>
          </div>
          <div>
            <span className="text-stone-400">Total: </span>
            <span className="font-medium">${stats.totalUsd.toLocaleString()} USD</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-2 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-stone-700 rounded-full transition-all"
            style={{ width: `${stats.total > 0 ? (stats.valued / stats.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Pricing list */}
      <div className="space-y-2">
        {displayed.map((piece) => (
          <PricingRow key={piece.id} piece={piece} user={user} onUpdate={fetchPieces} />
        ))}
      </div>
    </div>
  )
}

function PricingRow({ piece, user, onUpdate }) {
  const [editingValue, setEditingValue] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [valueUsd, setValueUsd] = useState('')
  const [source, setSource] = useState('')
  const [confidence, setConfidence] = useState('Media')
  const [title, setTitle] = useState(piece.title)
  const [saving, setSaving] = useState(false)
  const valueRef = useRef(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  async function saveValuation() {
    if (!valueUsd) return
    setSaving(true)
    await supabase.from('valuations').insert({
      piece_id: piece.id,
      estimated_value_usd: Number(valueUsd),
      value_source: source || 'Tasación directa',
      confidence,
      appraised_by: user?.email || 'Unknown',
      appraised_at: new Date().toISOString().split('T')[0],
    })
    setEditingValue(false)
    setSaving(false)
    onUpdate()
  }

  async function saveMeta() {
    if (title !== piece.title) {
      await supabase.from('pieces').update({ title }).eq('id', piece.id)
      onUpdate()
    }
    setEditingMeta(false)
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-3 flex gap-3 items-start">
      {/* Thumbnail */}
      <div className="w-12 h-12 bg-stone-100 rounded shrink-0 overflow-hidden">
        {piece.primary_thumbnail ? (
          <img
            src={`${supabaseUrl}/storage/v1/object/public/thumbnails/${piece.primary_thumbnail}`}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 text-sm">🖼</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {editingMeta ? (
          <div className="flex gap-1 mb-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm font-medium border-b border-stone-300 focus:outline-none focus:border-stone-600 flex-1"
              onKeyDown={(e) => e.key === 'Enter' && saveMeta()}
              onBlur={saveMeta}
            />
          </div>
        ) : (
          <p
            className="text-sm font-medium text-stone-800 truncate cursor-pointer hover:text-stone-600"
            onClick={() => setEditingMeta(true)}
            title="Clic para editar"
          >
            {piece.title}
          </p>
        )}
        <p className="text-xs text-stone-500 truncate">
          {piece.artist_name || 'Sin artista'}
        </p>

        {/* Value display or edit */}
        {editingValue ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex gap-1">
              <input
                ref={valueRef}
                type="number"
                value={valueUsd}
                onChange={(e) => setValueUsd(e.target.value)}
                placeholder="Valor USD"
                className="w-24 px-2 py-1 text-sm border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-500"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveValuation()}
              />
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Fuente"
                className="flex-1 px-2 py-1 text-sm border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-500"
                onKeyDown={(e) => e.key === 'Enter' && saveValuation()}
              />
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                className="px-2 py-1 text-sm border border-stone-300 rounded"
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
            <div className="flex gap-1">
              <button
                onClick={saveValuation}
                disabled={saving || !valueUsd}
                className="px-2 py-1 text-xs bg-stone-800 text-white rounded hover:bg-stone-700 disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditingValue(false)}
                className="px-2 py-1 text-xs text-stone-500 hover:text-stone-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            {piece.latest_value_usd ? (
              <>
                <span className="text-sm font-medium text-stone-700">
                  ${Number(piece.latest_value_usd).toLocaleString()} USD
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  piece.latest_confidence === 'Alta' ? 'bg-green-100 text-green-700' :
                  piece.latest_confidence === 'Media' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {piece.latest_confidence}
                </span>
              </>
            ) : (
              <span className="text-xs text-stone-400">Sin valorar</span>
            )}
            <button
              onClick={() => setEditingValue(true)}
              className="text-xs text-stone-400 hover:text-stone-700 ml-auto"
            >
              {piece.latest_value_usd ? 'Actualizar' : '+ Valorar'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
