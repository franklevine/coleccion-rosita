import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const HEARTS = ['', '♥', '♥♥', '♥♥♥']
const LABELS = ['', 'Me gusta', 'Lo quiero', 'Es importante para mí']

export default function Wishlist() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchWishlist()
  }, [user])

  async function fetchWishlist() {
    setLoading(true)
    const { data } = await supabase
      .from('wishlists')
      .select('*, pieces:piece_id(id, title, artist_id, artists:artist_id(name), latest_value_usd:valuations(estimated_value_usd))')
      .eq('user_id', user.id)
      .order('interest_level', { ascending: false })

    if (data) {
      setItems(data.map((w) => ({
        ...w,
        piece_title: w.pieces?.title || 'Sin título',
        artist_name: w.pieces?.artists?.name || 'Artista desconocido',
        value_usd: w.pieces?.latest_value_usd?.[0]?.estimated_value_usd || null,
      })))
    }
    setLoading(false)
  }

  const totalValue = items.reduce((sum, i) => sum + Number(i.value_usd || 0), 0)

  if (loading) return <p className="text-center text-stone-400 py-12">Cargando...</p>

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-semibold text-stone-800 mb-1">Mis Favoritos</h2>
      <p className="text-xs text-stone-400 mb-4">
        {items.length} {items.length === 1 ? 'obra seleccionada' : 'obras seleccionadas'}
        {totalValue > 0 && ` · Valor estimado: $${totalValue.toLocaleString()} USD`}
      </p>

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-stone-400 text-sm">No has marcado ninguna obra como favorita.</p>
          <Link to="/" className="text-sm text-stone-600 hover:text-stone-800 underline mt-2 inline-block">
            Explorar la galería
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/obra/${item.piece_id}`}
              className="block bg-white border border-stone-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-stone-800">{item.piece_title}</p>
                  <p className="text-xs text-stone-500">{item.artist_name}</p>
                </div>
                <div className="text-right">
                  <span className="text-red-500 text-sm">{HEARTS[item.interest_level]}</span>
                  <p className="text-xs text-stone-400">{LABELS[item.interest_level]}</p>
                </div>
              </div>
              {item.note && (
                <p className="text-xs text-stone-400 mt-1 italic">"{item.note}"</p>
              )}
              {item.value_usd && (
                <p className="text-xs text-stone-400 mt-1">
                  ${Number(item.value_usd).toLocaleString()} USD
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
