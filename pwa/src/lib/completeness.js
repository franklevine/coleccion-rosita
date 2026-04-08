/**
 * Calculate data completeness score for a piece (0-100).
 * Weights per spec section 6.3.
 */
export function calculateCompleteness(piece, { hasPhoto = false, hasValuation = false } = {}) {
  let score = 0

  // title: 15 pts if real title (not "Sin título" and not UUID-like)
  if (piece.title && piece.title !== 'Sin título' && !isUuidLike(piece.title)) {
    score += 15
  }

  // artist: 20 pts
  if (piece.artist_id || piece.artist_name) score += 20

  // medium: 10 pts
  if (piece.medium) score += 10

  // type_of_art: 5 pts
  if (piece.type_of_art) score += 5

  // dimensions: 5 pts
  if (piece.dimensions) score += 5

  // year_created: 5 pts
  if (piece.year_created) score += 5

  // location: 10 pts
  if (piece.location) score += 10

  // has_photo: 15 pts
  if (hasPhoto || piece.primary_thumbnail) score += 15

  // has_valuation: 15 pts
  if (hasValuation || piece.latest_value_usd) score += 15

  return score
}

function isUuidLike(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

/**
 * Returns completeness status: 'red', 'yellow', or 'green'
 */
export function completenessStatus(piece, options) {
  const score = typeof piece === 'number' ? piece : calculateCompleteness(piece, options)
  if (score < 35) return 'red'
  if (score < 70) return 'yellow'
  return 'green'
}
