import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { calculateCompleteness, completenessStatus } from '../lib/completeness'
import WishlistHeart from '../components/WishlistHeart'
import ArtistPicker from '../components/ArtistPicker'
import ImageLightbox from '../components/ImageLightbox'
import { useToast } from '../components/Toast'

const TYPES = ['Pintura', 'Escultura', 'Grabado', 'Fotografía', 'Dibujo', 'Mixta', 'Otro']
const STATUSES = ['Disponible', 'Vendida', 'Donada', 'Perdida', 'Dañada']
const CONFIDENCE = ['Alta', 'Media', 'Baja']
const TECHNIQUES = [
  'Óleo sobre tela', 'Óleo sobre madera', 'Acrílico sobre tela', 'Acuarela sobre papel',
  'Tinta sobre papel', 'Lápiz sobre papel', 'Carboncillo', 'Pastel', 'Técnica mixta',
  'Grabado', 'Litografía', 'Serigrafía', 'Xilografía', 'Aguafuerte',
  'Bronce', 'Mármol', 'Madera tallada', 'Cerámica', 'Fotografía',
]

// Fields saved to `pieces`
const PIECE_FIELDS = [
  'title', 'artist_id', 'year_created', 'medium', 'type_of_art', 'dimensions',
  'is_signed', 'notes', 'location', 'status', 'inventory_number',
  'provenance_notes', 'condition_notes', 'description',
]

const NAV_KEY = 'rosita.nav.ids'

export default function PieceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role, user } = useAuth()
  const { toast, show } = useToast()

  const [piece, setPiece] = useState(null)
  const [photos, setPhotos] = useState([])
  const [valuations, setValuations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)

  // Editable state
  const [form, setForm] = useState({})
  const [artistName, setArtistName] = useState('')
  const [val, setVal] = useState({ usd: '', clp: '', source: '', confidence: 'Media' })

  // Navigation order (prev / next)
  const [navIds, setNavIds] = useState([])

  const isAdmin = role === 'admin'
  const isLocked = piece?.is_locked && !isAdmin
  const canEdit = ['admin', 'editor', 'pricing'].includes(role) && !isLocked
  const canCreateArtist = ['admin', 'editor'].includes(role)
  const canValue = ['admin', 'editor', 'pricing'].includes(role)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const thumbUrl = (p) => `${supabaseUrl}/storage/v1/object/public/thumbnails/${p.thumbnail_path}`

  // ---------- Load ----------
  useEffect(() => {
    fetchAll()
    window.scrollTo({ top: 0 })
  }, [id])

  useEffect(() => {
    // Follow the gallery's current order if available; otherwise alphabetical
    let ids = []
    try { ids = JSON.parse(sessionStorage.getItem(NAV_KEY) || '[]') } catch { /* ignore */ }
    if (ids.includes(id)) { setNavIds(ids); return }
    supabase.from('pieces').select('id').order('title').then(({ data }) => {
      if (data) setNavIds(data.map((p) => p.id))
    })
  }, [id])

  async function fetchAll() {
    setLoading(true)
    const [pieceRes, photosRes, valRes] = await Promise.all([
      supabase.from('pieces_with_details').select('*').eq('id', id).single(),
      supabase.from('photos').select('*').eq('piece_id', id).order('slot'),
      supabase.from('valuations').select('*').eq('piece_id', id).order('created_at', { ascending: false }),
    ])
    if (pieceRes.data) {
      setPiece(pieceRes.data)
      resetForm(pieceRes.data, valRes.data?.[0])
    }
    if (photosRes.data) setPhotos(photosRes.data)
    if (valRes.data) setValuations(valRes.data)
    setLoading(false)
  }

  function resetForm(p, latest) {
    const f = {}
    for (const k of PIECE_FIELDS) f[k] = p[k] ?? (k === 'is_signed' ? false : '')
    setForm(f)
    setArtistName(p.artist_name || '')
    setVal({
      usd: latest?.estimated_value_usd ?? '',
      clp: latest?.estimated_value_clp ?? '',
      source: latest?.value_source ?? '',
      confidence: latest?.confidence ?? 'Media',
    })
    setMoreOpen(false)
  }

  // ---------- Dirty tracking ----------
  const latest = valuations[0]
  const pieceChanges = useMemo(() => {
    if (!piece) return {}
    const ch = {}
    for (const k of PIECE_FIELDS) {
      const before = piece[k] ?? (k === 'is_signed' ? false : '')
      let after = form[k]
      if (k === 'year_created') after = after === '' || after == null ? null : Number(after)
      const b = before === '' ? null : before
      const a = after === '' ? null : after
      if (a !== b) ch[k] = a
    }
    return ch
  }, [piece, form])

  const valueChanged = useMemo(() => {
    const n = (x) => (x === '' || x == null ? null : Number(x))
    const s = (x) => (x || '').trim() || null
    if (!canValue) return false
    const usd = n(val.usd), clp = n(val.clp)
    if (usd == null && clp == null) return false
    return (
      usd !== n(latest?.estimated_value_usd) ||
      clp !== n(latest?.estimated_value_clp) ||
      s(val.source) !== s(latest?.value_source) ||
      val.confidence !== (latest?.confidence ?? 'Media')
    )
  }, [val, latest, canValue])

  const dirty = Object.keys(pieceChanges).length > 0 || valueChanged

  // Warn before leaving the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // ---------- Save ----------
  async function save() {
    if (!dirty || saving) return true
    setSaving(true)
    try {
      let newValuation = null
      if (valueChanged) {
        const row = {
          piece_id: id,
          estimated_value_usd: val.usd === '' ? null : Number(val.usd),
          estimated_value_clp: val.clp === '' ? null : Number(val.clp),
          value_source: val.source.trim() || 'Tasación directa',
          confidence: val.confidence,
          appraised_by: user?.email || 'Desconocido',
          appraised_at: new Date().toISOString().split('T')[0],
        }
        const { data, error } = await supabase.from('valuations').insert(row).select('*').single()
        if (error) throw new Error('valor')
        newValuation = data
        await supabase.from('activity_log').insert({
          user_id: user?.id, action: 'valued', entity_type: 'valuation', entity_id: data.id,
          changes: { piece_id: id, usd: row.estimated_value_usd, clp: row.estimated_value_clp },
        })
      }

      const updates = { ...pieceChanges }
      const merged = { ...piece, ...updates }
      const completeness = calculateCompleteness(merged, {
        hasPhoto: photos.length > 0,
        hasValuation: valuations.length > 0 || !!newValuation,
      })
      if (Object.keys(updates).length > 0 || completeness !== piece.data_completeness) {
        updates.data_completeness = completeness
        const { error } = await supabase.from('pieces').update(updates).eq('id', id)
        if (error) throw new Error('obra')
        if (Object.keys(pieceChanges).length > 0) {
          await supabase.from('activity_log').insert({
            user_id: user?.id, action: 'updated', entity_type: 'piece', entity_id: id,
            changes: pieceChanges,
          })
        }
      }

      show('Guardado ✓')
      await fetchAll()
      return true
    } catch (e) {
      show(e.message === 'valor' ? 'No se pudo guardar el valor' : 'No se pudo guardar la obra', { error: true })
      return false
    } finally {
      setSaving(false)
    }
  }

  // ---------- Prev / next ----------
  const idx = navIds.indexOf(id)
  const prevId = idx > 0 ? navIds[idx - 1] : null
  const nextId = idx >= 0 && idx < navIds.length - 1 ? navIds[idx + 1] : null

  async function saveAndGo(targetId) {
    if (!targetId) return
    const ok = await save()
    if (ok) navigate(`/obra/${targetId}`)
  }

  function go(targetId) {
    if (!targetId) return
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return
    navigate(`/obra/${targetId}`)
  }

  // Keyboard: Ctrl/Cmd+S saves, Ctrl/Cmd+Enter saves & next
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveAndGo(nextId) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------- Render ----------
  if (loading && !piece) return <p className="text-center text-stone-400 py-12 text-lg">Cargando…</p>
  if (!piece) return <p className="text-center text-stone-400 py-12 text-lg">Obra no encontrada</p>

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const status = completenessStatus(piece.data_completeness || 0)
  const pct = piece.data_completeness || 0

  const missing = []
  if (!form.artist_id) missing.push('artista')
  if (!form.title || form.title === 'Sin título') missing.push('título')
  if (!form.medium) missing.push('técnica')
  if (!form.dimensions) missing.push('dimensiones')
  if (!form.year_created) missing.push('año')
  if (!form.location) missing.push('ubicación')
  if (photos.length === 0) missing.push('foto')
  if (valuations.length === 0 && !val.usd && !val.clp) missing.push('valor')

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3 pb-28">
      {toast}
      {lightbox && <ImageLightbox src={lightbox} alt={piece.title} onClose={() => setLightbox(null)} />}

      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <Link to="/" className="text-base text-stone-500 hover:text-stone-900">← Galería</Link>
        <div className="flex items-center gap-3 text-sm text-stone-500">
          {idx >= 0 && <span>Obra {idx + 1} de {navIds.length}</span>}
          {piece.inventory_number && <span className="font-mono text-stone-400">#{piece.inventory_number}</span>}
        </div>
      </div>

      {/* Photos */}
      <div className="mb-5">
        {photos.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto snap-x pb-1 -mx-4 px-4">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLightbox(thumbUrl(p))}
                className="shrink-0 snap-center rounded-2xl overflow-hidden bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-800"
              >
                <img src={thumbUrl(p)} alt={piece.title} className="h-72 sm:h-96 object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <div className="h-52 bg-stone-100 rounded-2xl flex flex-col items-center justify-center text-stone-400">
            <span className="text-5xl mb-2">🖼</span>
            <span className="text-base">Sin fotos todavía</span>
          </div>
        )}
      </div>

      {/* Completeness + actions row */}
      <div className="card mb-4 !py-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className={`dot-${status}`} />
            <span className="text-lg font-semibold">{pct}% completa</span>
          </div>
          <div className="flex items-center gap-3">
            <WishlistHeart pieceId={piece.id} />
            {isAdmin && (
              <button
                type="button"
                onClick={async () => {
                  await supabase.from('pieces').update({ is_locked: !piece.is_locked }).eq('id', id)
                  await fetchAll()
                }}
                className={`text-sm px-3 py-1.5 rounded-full ${piece.is_locked ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-500'}`}
              >
                {piece.is_locked ? '🔒 Bloqueada' : '🔓 Bloquear'}
              </button>
            )}
          </div>
        </div>
        <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${status === 'green' ? 'bg-emerald-500' : status === 'yellow' ? 'bg-amber-400' : 'bg-rose-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {missing.length > 0 && canEdit && (
          <p className="text-base text-stone-500 mt-2">
            Falta: <span className="text-stone-800 font-medium">{missing.join(', ')}</span>
          </p>
        )}
        {isLocked && <p className="text-sm text-rose-600 mt-2">Bloqueada por el administrador — solo lectura</p>}
        {!canEdit && !isLocked && <p className="text-sm text-stone-400 mt-2">Modo lectura</p>}
      </div>

      {/* ---------- Card 1: Identidad ---------- */}
      <section className="card mb-4">
        <h3 className="card__title">Identidad</h3>

        <label className="field-label" htmlFor="f-title">Título</label>
        {canEdit ? (
          <input
            id="f-title"
            className="field-input field-input--title"
            value={form.title}
            onChange={(e) => set('title')(e.target.value)}
            placeholder="Sin título"
          />
        ) : (
          <p className="field-read text-2xl font-semibold">{form.title || 'Sin título'}</p>
        )}

        <div className="mt-5">
          <label className="field-label">Artista</label>
          <ArtistPicker
            value={form.artist_id || null}
            label={artistName}
            disabled={!canEdit}
            canCreate={canCreateArtist}
            onError={(m) => show(m, { error: true })}
            onChange={({ id: aid, name }) => { set('artist_id')(aid || ''); setArtistName(name) }}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="f-year">Año</label>
            {canEdit ? (
              <input
                id="f-year"
                className="field-input"
                type="number"
                inputMode="numeric"
                min="1500"
                max={new Date().getFullYear()}
                value={form.year_created}
                onChange={(e) => set('year_created')(e.target.value)}
                placeholder="1985"
              />
            ) : <p className="field-read">{form.year_created || '—'}</p>}
          </div>
          <div>
            <label className="field-label">Firmada</label>
            <div className="flex items-center gap-3 min-h-14">
              <button
                type="button"
                role="switch"
                aria-checked={!!form.is_signed}
                disabled={!canEdit}
                onClick={() => set('is_signed')(!form.is_signed)}
                className={`toggle ${form.is_signed ? 'toggle--on' : ''} disabled:cursor-default`}
              >
                <span className="toggle__knob" />
              </button>
              <span className="text-xl">{form.is_signed ? 'Sí' : 'No'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Card 2: Técnica ---------- */}
      <section className="card mb-4">
        <h3 className="card__title">Técnica y tamaño</h3>

        <label className="field-label">Tipo</label>
        <div className="flex flex-wrap gap-2 mb-5">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={!canEdit}
              onClick={() => set('type_of_art')(form.type_of_art === t ? '' : t)}
              className={`chip ${form.type_of_art === t ? 'chip--on' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="f-medium">Técnica</label>
        {canEdit ? (
          <>
            <input
              id="f-medium"
              className="field-input"
              list="techniques"
              value={form.medium}
              onChange={(e) => set('medium')(e.target.value)}
              placeholder="Óleo sobre tela"
            />
            <datalist id="techniques">
              {TECHNIQUES.map((t) => <option key={t} value={t} />)}
            </datalist>
          </>
        ) : <p className="field-read">{form.medium || '—'}</p>}

        <div className="mt-5">
          <label className="field-label" htmlFor="f-dims">Dimensiones</label>
          {canEdit ? (
            <input
              id="f-dims"
              className="field-input"
              value={form.dimensions}
              onChange={(e) => set('dimensions')(e.target.value)}
              placeholder="80 × 60 cm"
            />
          ) : <p className="field-read">{form.dimensions || '—'}</p>}
        </div>
      </section>

      {/* ---------- Card 3: Valor ---------- */}
      <section className="card mb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
          <h3 className="card__title !mb-0">Valor estimado</h3>
          {latest && (
            <span className="text-sm text-stone-400">
              Última: {latest.appraised_at} · {latest.appraised_by?.split('@')[0]}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="f-usd">USD</label>
            {canValue ? (
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-stone-400">$</span>
                <input
                  id="f-usd"
                  className="field-input !pl-9"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={val.usd}
                  onChange={(e) => setVal((v) => ({ ...v, usd: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ) : <p className="field-read">{latest?.estimated_value_usd ? `$${Number(latest.estimated_value_usd).toLocaleString()}` : '—'}</p>}
          </div>
          <div>
            <label className="field-label" htmlFor="f-clp">CLP</label>
            {canValue ? (
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-stone-400">$</span>
                <input
                  id="f-clp"
                  className="field-input !pl-9"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={val.clp}
                  onChange={(e) => setVal((v) => ({ ...v, clp: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ) : <p className="field-read">{latest?.estimated_value_clp ? `$${Number(latest.estimated_value_clp).toLocaleString()}` : '—'}</p>}
          </div>
        </div>

        {canValue && (
          <>
            <div className="mt-5">
              <label className="field-label" htmlFor="f-source">Fuente</label>
              <input
                id="f-source"
                className="field-input"
                value={val.source}
                onChange={(e) => setVal((v) => ({ ...v, source: e.target.value }))}
                placeholder="Galería, tasador, subasta comparable…"
              />
            </div>
            <div className="mt-5">
              <label className="field-label">Confianza</label>
              <div className="flex gap-2">
                {CONFIDENCE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setVal((v) => ({ ...v, confidence: c }))}
                    className={`chip flex-1 chip--${c.toLowerCase()} ${val.confidence === c ? 'chip--on' : ''}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {valuations.length > 1 && (
          <details className="mt-4">
            <summary className="text-sm text-stone-500 cursor-pointer">Historial ({valuations.length})</summary>
            <ul className="mt-2 space-y-1 text-sm text-stone-500">
              {valuations.slice(1).map((v) => (
                <li key={v.id}>
                  {v.appraised_at} — {v.estimated_value_usd ? `$${Number(v.estimated_value_usd).toLocaleString()} USD` : ''}
                  {v.estimated_value_clp ? ` $${Number(v.estimated_value_clp).toLocaleString()} CLP` : ''} · {v.confidence} · {v.value_source}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ---------- Card 4: Notas ---------- */}
      <section className="card mb-4">
        <h3 className="card__title">Notas</h3>
        {canEdit ? (
          <textarea
            className="field-textarea"
            value={form.notes}
            onChange={(e) => set('notes')(e.target.value)}
            placeholder="Historia de la obra, dónde se compró, anécdotas familiares…"
          />
        ) : <p className="field-read whitespace-pre-wrap">{form.notes || '—'}</p>}
      </section>

      {/* ---------- Card 5: Más detalles (collapsed) ---------- */}
      <section className="card mb-4">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left"
        >
          <h3 className="card__title !mb-0">Más detalles</h3>
          <span className="text-stone-400 text-xl">{moreOpen ? '▴' : '▾'}</span>
        </button>
        {!moreOpen && (
          <p className="text-base text-stone-500 mt-2">
            {form.location || 'Sin ubicación'} · {form.status || 'Disponible'}
          </p>
        )}
        {moreOpen && (
          <div className="mt-4 space-y-5">
            <div>
              <label className="field-label" htmlFor="f-loc">Ubicación</label>
              {canEdit ? (
                <input id="f-loc" className="field-input" value={form.location} onChange={(e) => set('location')(e.target.value)} placeholder="Casa Vitacura, living" />
              ) : <p className="field-read">{form.location || '—'}</p>}
            </div>
            <div>
              <label className="field-label">Estado</label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button key={s} type="button" disabled={!canEdit} onClick={() => set('status')(s)}
                    className={`chip ${form.status === s ? 'chip--on' : ''}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="f-inv">N° inventario</label>
              {canEdit ? (
                <input id="f-inv" className="field-input font-mono" value={form.inventory_number} onChange={(e) => set('inventory_number')(e.target.value)} />
              ) : <p className="field-read font-mono">{form.inventory_number || '—'}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="f-prov">Procedencia</label>
              {canEdit ? (
                <textarea id="f-prov" className="field-textarea !min-h-24" value={form.provenance_notes} onChange={(e) => set('provenance_notes')(e.target.value)} placeholder="Comprada en…, regalo de…" />
              ) : <p className="field-read whitespace-pre-wrap">{form.provenance_notes || '—'}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="f-cond">Condición</label>
              {canEdit ? (
                <textarea id="f-cond" className="field-textarea !min-h-24" value={form.condition_notes} onChange={(e) => set('condition_notes')(e.target.value)} placeholder="Buen estado, marco original…" />
              ) : <p className="field-read whitespace-pre-wrap">{form.condition_notes || '—'}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="f-desc">Descripción</label>
              {canEdit ? (
                <textarea id="f-desc" className="field-textarea !min-h-24" value={form.description} onChange={(e) => set('description')(e.target.value)} />
              ) : <p className="field-read whitespace-pre-wrap">{form.description || '—'}</p>}
            </div>
          </div>
        )}
      </section>

      {/* ---------- Sticky action bar ---------- */}
      <div className="action-bar">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <button type="button" className="btn btn--ghost" onClick={() => go(prevId)} disabled={!prevId} aria-label="Anterior">
            ←<span className="hidden sm:inline"> Anterior</span>
          </button>

          {canEdit || canValue ? (
            <>
              <button
                type="button"
                className="btn btn--primary flex-1"
                onClick={save}
                disabled={!dirty || saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                className="btn btn--accent flex-[1.4]"
                onClick={() => (dirty ? saveAndGo(nextId) : go(nextId))}
                disabled={!nextId || saving}
                title="Ctrl/Cmd + Enter"
              >
                {dirty ? 'Guardar y siguiente' : 'Siguiente'} →
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--primary flex-1" onClick={() => go(nextId)} disabled={!nextId}>
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
