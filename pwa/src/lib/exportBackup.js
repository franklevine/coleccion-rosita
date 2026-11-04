import JSZip from 'jszip'
import { supabase } from './supabase'

const TABLES = ['artists', 'pieces', 'photos', 'valuations', 'wishlists', 'allocations', 'activity_log']

const CSV_COLUMNS = [
  ['id', 'ID'],
  ['inventory_number', 'Inventario'],
  ['title', 'Título'],
  ['artist_name', 'Artista'],
  ['artist_nationality', 'Nacionalidad artista'],
  ['year_created', 'Año'],
  ['type_of_art', 'Tipo'],
  ['medium', 'Técnica'],
  ['dimensions', 'Dimensiones'],
  ['is_signed', 'Firmada'],
  ['location', 'Ubicación'],
  ['status', 'Estado'],
  ['latest_value_usd', 'Valor USD'],
  ['latest_value_clp', 'Valor CLP'],
  ['latest_confidence', 'Confianza'],
  ['latest_value_source', 'Fuente valor'],
  ['data_completeness', 'Completitud %'],
  ['notes', 'Notas'],
  ['provenance_notes', 'Procedencia'],
  ['condition_notes', 'Condición'],
  ['description', 'Descripción'],
  ['tags', 'Etiquetas'],
  ['primary_thumbnail', 'Foto principal'],
  ['created_at', 'Creada'],
  ['updated_at', 'Actualizada'],
]

function csvCell(v) {
  if (v == null) return ''
  if (Array.isArray(v)) v = v.join('; ')
  if (typeof v === 'boolean') v = v ? 'Sí' : 'No'
  const s = String(v)
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows) {
  const header = CSV_COLUMNS.map(([, label]) => csvCell(label)).join(',')
  const lines = rows.map((r) => CSV_COLUMNS.map(([key]) => csvCell(r[key])).join(','))
  return '﻿' + [header, ...lines].join('\r\n') // BOM so Excel opens UTF-8 correctly
}

async function fetchAllRows(table) {
  // Supabase caps at 1000 rows per request; page to be safe.
  const out = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + page - 1)
    if (error) throw new Error(`No se pudo leer la tabla ${table}: ${error.message}`)
    out.push(...(data || []))
    if (!data || data.length < page) break
  }
  return out
}

function safeName(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

async function mapLimit(items, limit, fn) {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
}

/**
 * Build a full backup ZIP and trigger a browser download.
 * onProgress({ stage, done, total, message })
 * Returns { fileName, pieces, photos, failedPhotos }
 */
export async function exportBackup({ onProgress = () => {} } = {}) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const stamp = new Date().toISOString().slice(0, 10)
  const zip = new JSZip()

  // 1. Tables
  onProgress({ stage: 'datos', done: 0, total: TABLES.length, message: 'Leyendo base de datos…' })
  const tables = {}
  for (let i = 0; i < TABLES.length; i++) {
    tables[TABLES[i]] = await fetchAllRows(TABLES[i])
    onProgress({ stage: 'datos', done: i + 1, total: TABLES.length, message: `Tabla ${TABLES[i]}` })
  }
  const details = await fetchAllRows('pieces_with_details')

  zip.file(
    'datos/respaldo.json',
    JSON.stringify(
      {
        exportado: new Date().toISOString(),
        app: 'Colección Rosita Lira',
        version_esquema: 1,
        tablas: tables,
      },
      null,
      2,
    ),
  )
  zip.file('datos/obras.csv', toCsv(details))

  // 2. Photos (thumbnails from Supabase Storage)
  const byPiece = new Map(tables.pieces.map((p) => [p.id, p]))
  const photos = tables.photos.filter((p) => p.thumbnail_path)
  const failed = []
  let done = 0
  onProgress({ stage: 'fotos', done: 0, total: photos.length, message: 'Descargando fotos…' })

  await mapLimit(photos, 6, async (ph) => {
    const piece = byPiece.get(ph.piece_id)
    const base = safeName(piece?.inventory_number || piece?.title || ph.piece_id) || ph.piece_id
    const ext = (ph.thumbnail_path.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
    const name = `fotos/${base}__${ph.piece_id.slice(0, 8)}_${ph.slot}.${ext}`
    try {
      const res = await fetch(`${supabaseUrl}/storage/v1/object/public/thumbnails/${ph.thumbnail_path}`)
      if (!res.ok) throw new Error(res.status)
      zip.file(name, await res.arrayBuffer())
    } catch {
      failed.push(ph.thumbnail_path)
    } finally {
      done++
      onProgress({ stage: 'fotos', done, total: photos.length, message: `Foto ${done} de ${photos.length}` })
    }
  })

  // 3. Readme
  zip.file(
    'LEEME.txt',
    [
      `Respaldo — Colección Rosita Lira`,
      `Fecha: ${new Date().toLocaleString('es-CL')}`,
      ``,
      `Contenido:`,
      `  datos/respaldo.json  — todas las tablas (artistas, obras, fotos, valoraciones, deseos, asignaciones, actividad)`,
      `  datos/obras.csv      — tabla plana de obras con artista y última valoración (abrir en Excel / Numbers)`,
      `  fotos/               — miniaturas de cada obra: <inventario>__<id>_<slot>.jpg`,
      ``,
      `Obras: ${tables.pieces.length}   Artistas: ${tables.artists.length}   Valoraciones: ${tables.valuations.length}   Fotos: ${photos.length - failed.length}`,
      failed.length ? `\nFotos que no se pudieron descargar (${failed.length}):\n  ${failed.join('\n  ')}` : '',
      ``,
      `Las fotos en alta resolución viven en Google Drive (campo gdrive_url en la tabla photos).`,
    ].join('\n'),
  )

  // 4. Download
  onProgress({ stage: 'zip', done: 0, total: 1, message: 'Comprimiendo…' })
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, (m) =>
    onProgress({ stage: 'zip', done: m.percent / 100, total: 1, message: `Comprimiendo… ${Math.round(m.percent)}%` }),
  )
  const fileName = `coleccion-rosita-respaldo-${stamp}.zip`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)

  return { fileName, pieces: tables.pieces.length, photos: photos.length - failed.length, failedPhotos: failed.length, bytes: blob.size }
}
