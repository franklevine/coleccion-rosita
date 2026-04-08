import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function WishlistHeart({ pieceId }) {
  const { user, role } = useAuth()
  const [level, setLevel] = useState(0)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [wishId, setWishId] = useState(null)

  const canWishlist = ['admin', 'editor', 'viewer'].includes(role)

  useEffect(() => {
    if (user && canWishlist) fetchWishlist()
  }, [user, pieceId])

  async function fetchWishlist() {
    const { data } = await supabase
      .from('wishlists')
      .select('*')
      .eq('user_id', user.id)
      .eq('piece_id', pieceId)
      .maybeSingle()

    if (data) {
      setLevel(data.interest_level)
      setNote(data.note || '')
      setWishId(data.id)
    } else {
      setLevel(0)
      setNote('')
      setWishId(null)
    }
  }

  async function toggleHeart() {
    const newLevel = level >= 3 ? 0 : level + 1

    if (newLevel === 0 && wishId) {
      await supabase.from('wishlists').delete().eq('id', wishId)
      setWishId(null)
    } else if (newLevel > 0 && wishId) {
      await supabase.from('wishlists').update({ interest_level: newLevel }).eq('id', wishId)
    } else if (newLevel > 0) {
      const { data } = await supabase
        .from('wishlists')
        .insert({ user_id: user.id, piece_id: pieceId, interest_level: newLevel })
        .select()
        .single()
      if (data) setWishId(data.id)
    }

    setLevel(newLevel)
  }

  async function saveNote() {
    if (wishId) {
      await supabase.from('wishlists').update({ note }).eq('id', wishId)
    }
    setShowNote(false)
  }

  if (!canWishlist) return null

  const hearts = level > 0 ? '♥'.repeat(level) : '♡'
  const colorClass = level > 0 ? 'text-red-500' : 'text-stone-300'

  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={toggleHeart}
        onContextMenu={(e) => { e.preventDefault(); if (level > 0) setShowNote(true) }}
        className={`text-xl transition-colors ${colorClass} hover:text-red-400`}
        title={level === 0 ? 'Marcar como favorito' : `Nivel ${level} — toca para cambiar`}
      >
        {hearts}
      </button>

      {showNote && (
        <div className="ml-2 flex gap-1">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="¿Por qué te interesa?"
            className="text-xs px-2 py-1 border border-stone-300 rounded w-48 focus:outline-none focus:ring-1 focus:ring-stone-500"
            autoFocus
          />
          <button onClick={saveNote} className="text-xs text-stone-600 hover:text-stone-800">
            OK
          </button>
        </div>
      )}
    </div>
  )
}
