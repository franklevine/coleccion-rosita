import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Artists() {
  const [artists, setArtists] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchArtists()
  }, [])

  async function fetchArtists() {
    setLoading(true)
    const { data } = await supabase
      .from('artists')
      .select('*, pieces(id)')
      .order('name')

    if (data) {
      setArtists(data.map((a) => ({ ...a, piece_count: a.pieces?.length || 0 })))
    }
    setLoading(false)
  }

  const filtered = artists.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <p className="text-center text-stone-400 py-12">Cargando...</p>

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">Artistas ({artists.length})</h2>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar artista..."
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-stone-500"
      />

      <div className="space-y-2">
        {filtered.map((artist) => (
          <Link
            key={artist.id}
            to={`/?artist=${artist.id}`}
            className="block bg-white border border-stone-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-stone-800">{artist.name}</p>
                <p className="text-xs text-stone-500">
                  {artist.nationality || 'Nacionalidad desconocida'}
                  {artist.birth_year && ` · ${artist.birth_year}`}
                  {artist.death_year && `–${artist.death_year}`}
                </p>
              </div>
              <span className="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                {artist.piece_count} {artist.piece_count === 1 ? 'obra' : 'obras'}
              </span>
            </div>
            {artist.bio && (
              <p className="text-xs text-stone-400 mt-1 line-clamp-2">{artist.bio}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
