import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { completenessStatus } from '../lib/completeness'

const TYPES = ['Pintura', 'Escultura', 'Grabado', 'Fotografía', 'Dibujo', 'Mixta', 'Otro']
const STATUSES = ['Disponible', 'Vendida', 'Donada', 'Perdida', 'Dañada']
const SORT_OPTIONS = [
  { value: 'title', label: 'Título' },
  { value: 'artist', label: 'Artista' },
  { value: 'value', label: 'Valor' },
  { value: 'completeness', label: 'Completitud' },
]

export default function Gallery() {
  const [pieces, setPieces] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    location: '',
    artist_id: '',
    type_of_art: '',
    status: '',
  })
  const [sortBy, setSortBy] = useState('title')
  const [artists, setArtists] = useState([])
  const [locations, setLocations] = useState([])

  useEffect(() => {
    fetchPieces()
    fetchFilterOptions()
  }, [])

  async function fetchPieces() {
    setLoading(true)
    const { data, error } = await supabase
      .from('pieces_with_details')
      .select('*')

    if (!error && data) {
      setPieces(data)
    }
    setLoading(false)
  }

  async function fetchFilterOptions() {
    const [{ data: artistData }, { data: locationData }] = await Promise.all([
      supabase.from('artists').select('id, name').order('name'),
      supabase.from('pieces').select('location').not('location', 'is', null),
    ])

    if (artistData) setArtists(artistData)
    if (locationData) {
      const unique = [...new Set(locationData.map((p) => p.location).filter(Boolean))]
      setLocations(unique.sort())
    }
  }

  const filtered = pieces
    .filter((p) => {
      if (search) {
        const q = search.toLowerCase()
        const match =
          p.title?.toLowerCase().includes(q) ||
          p.artist_name?.toLowerCase().includes(q) ||
          p.inventory_number?.toLowerCase().includes(q)
        if (!match) return false
      }
      if (filters.location && p.location !== filters.location) return false
      if (filters.artist_id && p.artist_id !== filters.artist_id) return false
      if (filters.type_of_art && p.type_of_art !== filters.type_of_art) return false
      if (filters.status && p.status !== filters.status) return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'artist':
          return (a.artist_name || 'zzz').localeCompare(b.artist_name || 'zzz')
        case 'value':
          return (b.latest_value_usd || 0) - (a.latest_value_usd || 0)
        case 'completeness':
          return (b.data_completeness || 0) - (a.data_completeness || 0)
        default:
          return (a.title || '').localeCompare(b.title || '')
      }
    })

  return (
    <div className="px-4 py-4">
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, artista o inventario..."
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 text-xs">
        <select
          value={filters.type_of_art}
          onChange={(e) => setFilters({ ...filters, type_of_art: e.target.value })}
          className="px-2 py-1.5 border border-stone-300 rounded-lg bg-white shrink-0"
        >
          <option value="">Tipo</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          className="px-2 py-1.5 border border-stone-300 rounded-lg bg-white shrink-0"
        >
          <option value="">Ubicación</option>
          {locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        <select
          value={filters.artist_id}
          onChange={(e) => setFilters({ ...filters, artist_id: e.target.value })}
          className="px-2 py-1.5 border border-stone-300 rounded-lg bg-white shrink-0"
        >
          <option value="">Artista</option>
          {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-2 py-1.5 border border-stone-300 rounded-lg bg-white shrink-0"
        >
          <option value="">Estado</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-2 py-1.5 border border-stone-300 rounded-lg bg-white shrink-0"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Count */}
      <p className="text-xs text-stone-500 mb-3">
        {filtered.length} de {pieces.length} obras
      </p>

      {/* Grid */}
      {loading ? (
        <p className="text-center text-stone-400 py-12">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-stone-400 py-12">No se encontraron obras</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((piece) => (
            <PieceCard key={piece.id} piece={piece} />
          ))}
        </div>
      )}
    </div>
  )
}

function PieceCard({ piece }) {
  const status = completenessStatus(piece.data_completeness || 0)
  const thumbnailUrl = piece.primary_thumbnail
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/thumbnails/${piece.primary_thumbnail}`
    : null

  return (
    <Link
      to={`/obra/${piece.id}`}
      className="block bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Image */}
      <div className="aspect-square bg-stone-100 relative">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={piece.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl">
            🖼
          </div>
        )}
        {/* Completeness dot */}
        <div className={`absolute top-2 right-2 dot-${status}`} />
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-sm font-medium text-stone-800 truncate">
          {piece.title}
        </p>
        <p className="text-xs text-stone-500 truncate">
          {piece.artist_name || 'Artista desconocido'}
        </p>
        {piece.latest_value_usd && (
          <p className="text-xs text-stone-400 mt-0.5">
            ${Number(piece.latest_value_usd).toLocaleString()} USD
          </p>
        )}
      </div>
    </Link>
  )
}
