import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Artist autocomplete with inline "create new".
 *
 * props:
 *   value      – artist id (or null)
 *   label      – current artist name (for display before the list loads)
 *   onChange   – ({ id, name }) => void   (id null = unknown artist)
 *   disabled   – read-only mode
 *   canCreate  – whether the current role may insert new artists
 *   onError    – (msg) => void
 */
export default function ArtistPicker({ value, label, onChange, disabled, canCreate, onError }) {
  const [artists, setArtists] = useState([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(label || '')
  const [creating, setCreating] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    supabase.from('artists').select('id, name, nationality').order('name').then(({ data }) => {
      if (data) setArtists(data)
    })
  }, [])

  // Keep the text in sync when the parent changes the artist (e.g. navigating to next piece)
  const [synced, setSynced] = useState({ label, value })
  if (synced.label !== label || synced.value !== value) {
    setSynced({ label, value })
    setQuery(label || '')
  }

  // Close on outside click
  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setQuery(label || '')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [label])

  const normalized = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const matches = useMemo(() => {
    const q = normalized(query.trim())
    if (!q) return artists.slice(0, 8)
    return artists.filter((a) => normalized(a.name).includes(q)).slice(0, 8)
  }, [artists, query])

  const exact = artists.find((a) => normalized(a.name) === normalized(query.trim()))
  const showCreate = canCreate && query.trim().length >= 2 && !exact
  const optionCount = matches.length + (showCreate ? 1 : 0) + (value ? 1 : 0)

  function select(artist) {
    onChange({ id: artist.id, name: artist.name })
    setQuery(artist.name)
    setOpen(false)
  }

  function clear() {
    onChange({ id: null, name: '' })
    setQuery('')
    setOpen(false)
  }

  async function createNew() {
    const name = query.trim()
    if (!name) return
    setCreating(true)
    const { data, error } = await supabase
      .from('artists')
      .insert({ name })
      .select('id, name, nationality')
      .single()
    setCreating(false)
    if (error) {
      onError?.('No se pudo crear el artista (¿tienes permiso de editor?)')
      return
    }
    setArtists((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    select(data)
  }

  function onKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, optionCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlight < matches.length) select(matches[highlight])
      else if (showCreate && highlight === matches.length) createNew()
      else clear()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(label || '')
    }
  }

  if (disabled) {
    return (
      <p className="text-xl font-medium text-stone-900 py-2">
        {label || <span className="text-stone-400 font-normal">Artista desconocido</span>}
      </p>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0) }}
        onFocus={(e) => { setOpen(true); setHighlight(0); e.target.select() }}
        onKeyDown={onKeyDown}
        placeholder="Escribe el nombre del artista…"
        autoComplete="off"
        className="field-input"
      />
      {query && (
        <button
          type="button"
          onClick={clear}
          aria-label="Quitar artista"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xl leading-none"
        >
          ×
        </button>
      )}

      {open && (
        <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {matches.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(a)}
                className={`w-full text-left px-4 py-3 text-lg flex justify-between items-center ${
                  i === highlight ? 'bg-stone-100' : 'hover:bg-stone-50'
                } ${a.id === value ? 'font-semibold' : ''}`}
              >
                <span>{a.name}</span>
                {a.nationality && <span className="text-sm text-stone-400">{a.nationality}</span>}
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={createNew}
                disabled={creating}
                className={`w-full text-left px-4 py-3 text-lg text-emerald-800 ${
                  highlight === matches.length ? 'bg-emerald-50' : 'hover:bg-emerald-50'
                }`}
              >
                {creating ? 'Creando…' : <>+ Crear artista «<strong>{query.trim()}</strong>»</>}
              </button>
            </li>
          )}
          {matches.length === 0 && !showCreate && (
            <li className="px-4 py-3 text-stone-400">Sin resultados</li>
          )}
          {value && (
            <li className="border-t border-stone-100">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clear}
                className={`w-full text-left px-4 py-3 text-base text-stone-500 ${
                  highlight === optionCount - 1 ? 'bg-stone-100' : 'hover:bg-stone-50'
                }`}
              >
                Marcar como artista desconocido
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
