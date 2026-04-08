import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)

    const [{ data: pieces }, { data: valuations }] = await Promise.all([
      supabase.from('pieces_with_details').select('*'),
      supabase.from('valuations').select('estimated_value_usd, piece_id'),
    ])

    if (pieces) {
      const total = pieces.length
      const withArtist = pieces.filter((p) => p.artist_name).length
      const withPhoto = pieces.filter((p) => p.primary_thumbnail).length
      const withValue = pieces.filter((p) => p.latest_value_usd).length
      const totalValue = pieces.reduce((sum, p) => sum + Number(p.latest_value_usd || 0), 0)

      // Group by type
      const byType = {}
      pieces.forEach((p) => {
        const t = p.type_of_art || 'Sin tipo'
        byType[t] = (byType[t] || 0) + 1
      })

      // Group by location
      const byLocation = {}
      pieces.forEach((p) => {
        const l = p.location || 'Sin ubicación'
        byLocation[l] = (byLocation[l] || 0) + 1
      })

      // Top artists
      const artistCounts = {}
      pieces.forEach((p) => {
        if (p.artist_name) {
          artistCounts[p.artist_name] = (artistCounts[p.artist_name] || 0) + 1
        }
      })
      const topArtists = Object.entries(artistCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      // Average completeness
      const avgCompleteness = total > 0
        ? Math.round(pieces.reduce((sum, p) => sum + (p.data_completeness || 0), 0) / total)
        : 0

      setStats({
        total,
        withArtist,
        withPhoto,
        withValue,
        totalValue,
        byType,
        byLocation,
        topArtists,
        avgCompleteness,
      })
    }
    setLoading(false)
  }

  if (loading) return <p className="text-center text-stone-400 py-12">Cargando...</p>
  if (!stats) return null

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">Resumen de la Colección</h2>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Total obras" value={stats.total} />
        <StatCard label="Valor estimado" value={`$${stats.totalValue.toLocaleString()}`} sub="USD" />
        <StatCard label="Con artista" value={`${stats.withArtist}/${stats.total}`} sub={`${pct(stats.withArtist, stats.total)}%`} />
        <StatCard label="Valoradas" value={`${stats.withValue}/${stats.total}`} sub={`${pct(stats.withValue, stats.total)}%`} />
        <StatCard label="Con foto" value={`${stats.withPhoto}/${stats.total}`} sub={`${pct(stats.withPhoto, stats.total)}%`} />
        <StatCard label="Completitud promedio" value={`${stats.avgCompleteness}%`} />
      </div>

      {/* Distribution by type */}
      <Section title="Por tipo">
        {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
          <BarRow key={type} label={type} count={count} total={stats.total} />
        ))}
      </Section>

      {/* Distribution by location */}
      <Section title="Por ubicación">
        {Object.entries(stats.byLocation).sort((a, b) => b[1] - a[1]).map(([loc, count]) => (
          <BarRow key={loc} label={loc} count={count} total={stats.total} />
        ))}
      </Section>

      {/* Top artists */}
      <Section title="Artistas principales">
        {stats.topArtists.map(([name, count]) => (
          <BarRow key={name} label={name} count={count} total={stats.total} />
        ))}
      </Section>
    </div>
  )
}

function pct(n, total) {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-stone-200 rounded-lg p-3">
      <p className="text-xs text-stone-400">{label}</p>
      <p className="text-xl font-semibold text-stone-800">{value}</p>
      {sub && <p className="text-xs text-stone-400">{sub}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-stone-700 mb-2 border-b pb-1">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function BarRow({ label, count, total }) {
  const pctValue = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-stone-600 w-36 truncate text-xs">{label}</span>
      <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
        <div className="h-full bg-stone-400 rounded-full" style={{ width: `${pctValue}%` }} />
      </div>
      <span className="text-xs text-stone-400 w-8 text-right">{count}</span>
    </div>
  )
}
