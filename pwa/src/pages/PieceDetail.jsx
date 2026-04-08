import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { calculateCompleteness, completenessStatus } from '../lib/completeness'
import WishlistHeart from '../components/WishlistHeart'

export default function PieceDetail() {
  const { id } = useParams()
  const { role } = useAuth()
  const [piece, setPiece] = useState(null)
  const [photos, setPhotos] = useState([])
  const [valuations, setValuations] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const isLocked = piece?.is_locked && role !== 'admin'
  const canEdit = !isLocked
  const isAdmin = role === 'admin'

  useEffect(() => {
    fetchAll()
  }, [id])

  async function fetchAll() {
    setLoading(true)
    const [pieceRes, photosRes, valRes, actRes] = await Promise.all([
      supabase.from('pieces_with_details').select('*').eq('id', id).single(),
      supabase.from('photos').select('*').eq('piece_id', id).order('slot'),
      supabase.from('valuations').select('*').eq('piece_id', id).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
    ])

    if (pieceRes.data) {
      setPiece(pieceRes.data)
      setForm(pieceRes.data)
    }
    if (photosRes.data) setPhotos(photosRes.data)
    if (valRes.data) setValuations(valRes.data)
    if (actRes.data) setActivity(actRes.data)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const updates = {}
    const editableFields = ['title', 'artist_id', 'year_created', 'medium', 'type_of_art', 'dimensions', 'location', 'status', 'condition_notes', 'provenance_notes', 'description', 'notes', 'is_signed']

    for (const field of editableFields) {
      if (form[field] !== piece[field]) {
        updates[field] = form[field] || null
      }
    }

    if (Object.keys(updates).length > 0) {
      // Recalculate completeness
      const merged = { ...piece, ...updates }
      updates.data_completeness = calculateCompleteness(merged, {
        hasPhoto: photos.length > 0,
        hasValuation: valuations.length > 0,
      })

      const { error } = await supabase.from('pieces').update(updates).eq('id', id)
      if (!error) {
        await fetchAll()
        setEditing(false)
      }
    } else {
      setEditing(false)
    }
    setSaving(false)
  }

  if (loading) return <p className="text-center text-stone-400 py-12">Cargando...</p>
  if (!piece) return <p className="text-center text-stone-400 py-12">Obra no encontrada</p>

  const status = completenessStatus(piece.data_completeness || 0)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      {/* Back */}
      <Link to="/" className="text-sm text-stone-500 hover:text-stone-800 mb-4 inline-block">
        ← Volver a galería
      </Link>

      {/* Photos */}
      <div className="mb-6">
        {photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto snap-x">
            {photos.map((photo) => (
              <div key={photo.id} className="shrink-0 snap-center">
                <img
                  src={`${supabaseUrl}/storage/v1/object/public/thumbnails/${photo.thumbnail_path}`}
                  alt={piece.title}
                  className="h-64 sm:h-80 rounded-lg object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="h-48 bg-stone-100 rounded-lg flex items-center justify-center text-stone-300 text-5xl">
            🖼
          </div>
        )}
      </div>

      {/* Title + completeness */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">{piece.title}</h2>
          <p className="text-stone-500">
            {piece.artist_name || 'Artista desconocido'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`dot-${status}`} />
          <span className="text-xs text-stone-400">{piece.data_completeness || 0}%</span>
        </div>
      </div>

      {/* Wishlist heart */}
      <div className="mb-4">
        <WishlistHeart pieceId={piece.id} />
      </div>

      {/* Lock indicator + Edit toggle */}
      <div className="flex items-center gap-3 mb-4">
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            Editar
          </button>
        )}
        {isLocked && (
          <span className="text-xs text-red-500">Bloqueada por admin</span>
        )}
        {isAdmin && (
          <button
            onClick={async () => {
              await supabase.from('pieces').update({ is_locked: !piece.is_locked }).eq('id', id)
              await fetchAll()
            }}
            className={`text-xs px-2 py-1 rounded ${piece.is_locked ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-500'}`}
          >
            {piece.is_locked ? 'Desbloquear' : 'Bloquear edición'}
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-3 mb-6">
        {editing ? (
          <EditForm
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onCancel={() => { setEditing(false); setForm(piece) }}
            saving={saving}
          />
        ) : (
          <MetadataDisplay piece={piece} />
        )}
      </div>

      {/* Missing data prompts */}
      {canEdit && !editing && <MissingPrompts piece={piece} photos={photos} valuations={valuations} onEdit={() => setEditing(true)} />}

      {/* Valuations */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-stone-700 mb-2 border-b pb-1">
          Valoraciones ({valuations.length})
        </h3>
        {valuations.length === 0 ? (
          <p className="text-sm text-stone-400">Sin valoraciones aún</p>
        ) : (
          <div className="space-y-2">
            {valuations.map((v) => (
              <div key={v.id} className="text-sm bg-white border border-stone-200 rounded-lg p-3">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {v.estimated_value_usd ? `$${Number(v.estimated_value_usd).toLocaleString()} USD` : ''}
                    {v.estimated_value_usd && v.estimated_value_clp ? ' / ' : ''}
                    {v.estimated_value_clp ? `$${Number(v.estimated_value_clp).toLocaleString()} CLP` : ''}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    v.confidence === 'Alta' ? 'bg-green-100 text-green-700' :
                    v.confidence === 'Media' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {v.confidence}
                  </span>
                </div>
                <p className="text-stone-500 text-xs mt-1">
                  {v.value_source} — {v.appraised_by} ({v.appraised_at})
                </p>
                {v.notes && <p className="text-stone-400 text-xs mt-1">{v.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Activity log */}
      <section>
        <h3 className="text-sm font-semibold text-stone-700 mb-2 border-b pb-1">
          Actividad reciente
        </h3>
        {activity.length === 0 ? (
          <p className="text-sm text-stone-400">Sin actividad registrada</p>
        ) : (
          <div className="space-y-1">
            {activity.map((a) => (
              <p key={a.id} className="text-xs text-stone-400">
                <span className="text-stone-600">{a.action}</span>
                {' — '}
                {new Date(a.created_at).toLocaleDateString('es-CL')}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function MetadataDisplay({ piece }) {
  const fields = [
    { label: 'Año', value: piece.year_created },
    { label: 'Técnica', value: piece.medium },
    { label: 'Tipo', value: piece.type_of_art },
    { label: 'Dimensiones', value: piece.dimensions },
    { label: 'Ubicación', value: piece.location },
    { label: 'Estado', value: piece.status },
    { label: 'Firmada', value: piece.is_signed ? 'Sí' : 'No' },
    { label: 'Inventario', value: piece.inventory_number },
    { label: 'Procedencia', value: piece.provenance_notes },
    { label: 'Descripción', value: piece.description },
    { label: 'Notas', value: piece.notes },
    { label: 'Condición', value: piece.condition_notes },
  ]

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {fields.map((f) => (
        <div key={f.label}>
          <span className="text-stone-400 text-xs">{f.label}</span>
          <p className="text-stone-700">{f.value || '—'}</p>
        </div>
      ))}
    </div>
  )
}

function EditForm({ form, setForm, onSave, onCancel, saving }) {
  const set = (field) => (e) =>
    setForm({ ...form, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const inputClass = 'w-full px-2 py-1.5 border border-stone-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-stone-500'

  return (
    <div className="space-y-3">
      <Field label="Título">
        <input value={form.title || ''} onChange={set('title')} className={inputClass} />
      </Field>
      <Field label="Año">
        <input type="number" value={form.year_created || ''} onChange={set('year_created')} className={inputClass} />
      </Field>
      <Field label="Técnica">
        <input value={form.medium || ''} onChange={set('medium')} className={inputClass} placeholder="Óleo sobre tela" />
      </Field>
      <Field label="Tipo">
        <select value={form.type_of_art || ''} onChange={set('type_of_art')} className={inputClass}>
          <option value="">—</option>
          {['Pintura', 'Escultura', 'Grabado', 'Fotografía', 'Dibujo', 'Mixta', 'Otro'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Dimensiones">
        <input value={form.dimensions || ''} onChange={set('dimensions')} className={inputClass} placeholder="80 × 60 cm" />
      </Field>
      <Field label="Ubicación">
        <input value={form.location || ''} onChange={set('location')} className={inputClass} />
      </Field>
      <Field label="Estado">
        <select value={form.status || ''} onChange={set('status')} className={inputClass}>
          {['Disponible', 'Vendida', 'Donada', 'Perdida', 'Dañada'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Condición">
        <textarea value={form.condition_notes || ''} onChange={set('condition_notes')} className={inputClass} rows={2} />
      </Field>
      <Field label="Procedencia">
        <textarea value={form.provenance_notes || ''} onChange={set('provenance_notes')} className={inputClass} rows={2} />
      </Field>
      <Field label="Descripción">
        <textarea value={form.description || ''} onChange={set('description')} className={inputClass} rows={2} />
      </Field>
      <Field label="Notas">
        <textarea value={form.notes || ''} onChange={set('notes')} className={inputClass} rows={2} />
      </Field>
      <Field label="Firmada">
        <input type="checkbox" checked={form.is_signed || false} onChange={set('is_signed')} />
      </Field>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-stone-500 text-sm rounded-lg hover:bg-stone-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-stone-400 mb-0.5">{label}</label>
      {children}
    </div>
  )
}

function MissingPrompts({ piece, photos, valuations, onEdit }) {
  const missing = []
  if (!piece.artist_name && !piece.artist_id)
    missing.push('¿Conoces al artista? Toca para agregar')
  if (piece.title === 'Sin título')
    missing.push('¿Sabes el título de esta obra?')
  if (!piece.medium)
    missing.push('¿Qué técnica se usó? (óleo, acrílico, etc.)')
  if (!piece.dimensions)
    missing.push('¿Conoces las dimensiones?')
  if (photos.length === 0)
    missing.push('Esta obra no tiene fotos')
  if (valuations.length === 0)
    missing.push('Esta obra no ha sido valorada')

  if (missing.length === 0) return null

  return (
    <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <p className="text-xs font-medium text-amber-800 mb-2">Datos faltantes:</p>
      <div className="space-y-1">
        {missing.map((msg, i) => (
          <button
            key={i}
            onClick={onEdit}
            className="block text-xs text-amber-700 hover:text-amber-900 underline"
          >
            {msg}
          </button>
        ))}
      </div>
    </div>
  )
}
