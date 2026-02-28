import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

const PAGE_SIZE = 48

const CATEGORY_LABELS = {
  'all': 'All Plants',
  'trees': 'Trees',
  'shrubs': 'Shrubs',
  'vines': 'Vines',
  'wildflowers-and-herbs': 'Wildflowers & Herbs',
  'grasses-and-sedges': 'Grasses & Sedges',
  'ferns': 'Ferns',
  'mosses-and-liverworts': 'Mosses & Liverworts',
  'lichens': 'Lichens',
  'other': 'Other',
}

function PlantCard({ plant }) {
  const displayName = plant.common_name || plant.scientific_name
  const sciName = plant.scientific_name
  const encodedName = encodeURIComponent(sciName)

  return (
    <Link to={`/plant/${encodedName}`} className="plant-card">
      {plant.thumbnail ? (
        <img
          className="plant-card__image"
          src={plant.thumbnail}
          alt={displayName}
          loading="lazy"
          onError={e => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
          }}
        />
      ) : null}
      <div
        className="plant-card__image-placeholder"
        style={{ display: plant.thumbnail ? 'none' : 'flex' }}
      >
        🌿
      </div>
      <div className="plant-card__body">
        <div className="plant-card__common">{displayName}</div>
        <div className="plant-card__scientific">{sciName}</div>
        {plant.native_status === 'N' && (
          <span className="plant-card__badge">Native</span>
        )}
      </div>
    </Link>
  )
}

export default function CategoryPage() {
  const { slug } = useParams()
  const [plants, setPlants] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [nativeOnly, setNativeOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const categoryLabel = CATEGORY_LABELS[slug] || slug

  const fetchPlants = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      skip: page * PAGE_SIZE,
      limit: PAGE_SIZE,
      native_only: nativeOnly,
    })
    if (slug !== 'all') params.set('category', slug)
    if (search.trim()) params.set('search', search.trim())

    fetch(`/api/plants?${params}`)
      .then(r => r.json())
      .then(data => {
        setPlants(data.plants || [])
        setTotal(data.total || 0)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [slug, page, search, nativeOnly])

  useEffect(() => {
    setPage(0)
  }, [slug, search, nativeOnly])

  useEffect(() => {
    fetchPlants()
  }, [fetchPlants])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="section">
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span>›</span>
          <span>{categoryLabel}</span>
        </div>

        <h2 className="section__title">{categoryLabel}</h2>
        <p className="section__subtitle">
          {loading ? 'Loading…' : `${total.toLocaleString()} species found`}
        </p>

        {/* Filters */}
        <div className="filters">
          <input
            className="search-input"
            type="search"
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={nativeOnly}
              onChange={e => setNativeOnly(e.target.checked)}
            />
            Native species only
          </label>
        </div>

        {/* Grid */}
        {error && <div className="error">Error: {error}</div>}
        {loading && <div className="loading">Loading plants…</div>}

        {!loading && !error && plants.length === 0 && (
          <div className="loading">No plants found matching your criteria.</div>
        )}

        {!loading && !error && plants.length > 0 && (
          <div className="plant-grid">
            {plants.map(plant => (
              <PlantCard key={plant.scientific_name} plant={plant} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageNum = totalPages <= 7
                ? i
                : page < 4
                  ? i
                  : page > totalPages - 5
                    ? totalPages - 7 + i
                    : page - 3 + i
              return (
                <button
                  key={pageNum}
                  className={page === pageNum ? 'active' : ''}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </button>
              )
            })}
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
