import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'

const PAGE_SIZE = 48

const CATEGORY_LABELS = {
  'all': 'All Plants', 'trees': 'Trees', 'shrubs': 'Shrubs', 'vines': 'Vines',
  'wildflowers-and-herbs': 'Wildflowers & Herbs', 'grasses-and-sedges': 'Grasses & Sedges',
  'ferns': 'Ferns', 'mosses-and-liverworts': 'Mosses & Liverworts', 'lichens': 'Lichens', 'other': 'Other',
}

const DURATION_LABELS = { 'Perennial': 'Perennial', 'Annual': 'Annual', 'Biennial': 'Biennial' }
const NATIVE_STATUS_LABELS = { 'N': 'Native', 'I': 'Introduced', 'U': 'Unknown' }
const BOOL_FILTERS = [
  { key: 'wildlife', label: 'Wildlife Value', icon: '🦋' },
  { key: 'pollinator', label: 'Pollinator Plant', icon: '🐝' },
  { key: 'wetland', label: 'Wetland Species', icon: '💧' },
]

function TriToggle({ label, icon, state, onChange }) {
  const handleClick = () => {
    if (state === null) onChange(true)
    else if (state === true) onChange(false)
    else onChange(null)
  }
  const cls = state === null ? 'tri-toggle tri-toggle--null' : state === true ? 'tri-toggle tri-toggle--true' : 'tri-toggle tri-toggle--false'
  const indicator = state === null ? '' : state === true ? ' ✓' : ' ✗'
  return (
    <button onClick={handleClick} className={cls}>
      {icon && <span>{icon}</span>}
      {label}{indicator}
    </button>
  )
}

function PlantCard({ plant }) {
  const displayName = plant.common_name || plant.scientific_name
  const encodedName = encodeURIComponent(plant.scientific_name)
  const badgeClass = plant.native_status === 'N' ? 'plant-card__badge badge--native'
    : plant.native_status === 'I' ? 'plant-card__badge badge--intro'
    : plant.native_status === 'U' ? 'plant-card__badge badge--unknown' : null
  const badgeLabel = plant.native_status === 'N' ? 'Native' : plant.native_status === 'I' ? 'Introduced' : plant.native_status === 'U' ? 'Unknown' : null

  return (
    <Link to={`/plant/${encodedName}`} className="plant-card">
      {plant.thumbnail ? (
        <img
          className="plant-card__image"
          src={plant.thumbnail}
          alt={displayName}
          loading="lazy"
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
        />
      ) : null}
      <div className="plant-card__image-placeholder" style={{ display: plant.thumbnail ? 'none' : 'flex' }}>🌿</div>
      <div className="plant-card__body">
        <div className="plant-card__common">{displayName}</div>
        <div className="plant-card__scientific">{plant.scientific_name}</div>
        {badgeClass && <span className={badgeClass}>{badgeLabel}</span>}
      </div>
    </Link>
  )
}

function buildFilterParams({ page, slug, search, nativeStates, durationStates, boolStates }) {
  const params = new URLSearchParams({ skip: page * PAGE_SIZE, limit: PAGE_SIZE })
  if (slug !== 'all') params.set('category', slug)
  if (search.trim()) params.set('search', search.trim())
  const nativeIncludes = Object.entries(nativeStates).filter(([, v]) => v === true).map(([k]) => k)
  const nativeExcludes = Object.entries(nativeStates).filter(([, v]) => v === false).map(([k]) => k)
  if (nativeIncludes.length > 0) params.set('native_status', nativeIncludes.join(','))
  else if (nativeExcludes.length > 0) params.set('native_status', '!' + nativeExcludes.join(','))
  const durIncludes = Object.entries(durationStates).filter(([, v]) => v === true).map(([k]) => k)
  const durExcludes = Object.entries(durationStates).filter(([, v]) => v === false).map(([k]) => k)
  if (durIncludes.length > 0) params.set('duration', durIncludes.join(','))
  else if (durExcludes.length > 0) params.set('duration', '!' + durExcludes.join(','))
  for (const { key } of BOOL_FILTERS) {
    const val = boolStates[key]
    if (val === true) params.set(key, 'true')
    else if (val === false) params.set(key, 'false')
  }
  return params
}

export default function CategoryPage() {
  const { slug } = useParams()
  const [plants, setPlants] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [durations, setDurations] = useState([])
  const [nativeStates, setNativeStates] = useState({})
  const [durationStates, setDurationStates] = useState({})
  const [boolStates, setBoolStates] = useState({})

  const categoryLabel = CATEGORY_LABELS[slug] || slug

  useEffect(() => {
    fetch('/api/filter-options').then(r => r.json())
      .then(data => setDurations(data.durations || []))
      .catch(() => setDurations(['Perennial', 'Annual', 'Biennial']))
  }, [])

  const fetchPlants = useCallback(() => {
    setLoading(true)
    const params = buildFilterParams({ page, slug, search, nativeStates, durationStates, boolStates })
    fetch(`/api/plants?${params}`)
      .then(r => r.json())
      .then(data => { setPlants(data.plants || []); setTotal(data.total || 0); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [slug, page, search, nativeStates, durationStates, boolStates])

  useEffect(() => { setPage(0) }, [slug, search, nativeStates, durationStates, boolStates])
  useEffect(() => { fetchPlants() }, [fetchPlants])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasActiveFilters =
    Object.values(nativeStates).some(v => v !== null) ||
    Object.values(durationStates).some(v => v !== null) ||
    Object.values(boolStates).some(v => v !== null)

  const clearAllFilters = () => { setNativeStates({}); setDurationStates({}); setBoolStates({}); setSearch('') }

  return (
    <div style={{ padding: '3rem', maxWidth: 1400, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>›</span>
        <span>{categoryLabel}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div className="section__eyebrow">Browse</div>
        <h1 className="section__title">{categoryLabel}</h1>
        <p className="section__subtitle">
          {loading ? 'Loading…' : `${total.toLocaleString()} species found`}
          {hasActiveFilters && (
            <button className="clear-filters-btn" onClick={clearAllFilters}>Clear all filters</button>
          )}
        </p>
      </div>

      {/* Search */}
      <input
        className="search-input"
        type="search"
        placeholder="Search by common or scientific name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Filter panel */}
      <div className="filters-panel">
        <div style={{ marginBottom: '0.75rem' }}>
          <span className="filter-section-title">Origin</span>
          <div className="filters-panel__row">
            {['N', 'I', 'U'].map(val => (
              <TriToggle
                key={val}
                label={NATIVE_STATUS_LABELS[val]}
                icon={val === 'N' ? '🌿' : val === 'I' ? '⚠️' : '❓'}
                state={nativeStates[val] ?? null}
                onChange={newState => setNativeStates(prev => ({ ...prev, [val]: newState }))}
              />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <span className="filter-section-title">Life Cycle</span>
          <div className="filters-panel__row">
            {(durations.length > 0 ? durations : ['Perennial', 'Annual', 'Biennial']).map(val => (
              <TriToggle
                key={val}
                label={DURATION_LABELS[val] || val}
                icon={val === 'Perennial' ? '🔄' : val === 'Annual' ? '1️⃣' : '2️⃣'}
                state={durationStates[val] ?? null}
                onChange={newState => setDurationStates(prev => ({ ...prev, [val]: newState }))}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="filter-section-title">Ecological Value</span>
          <div className="filters-panel__row">
            {BOOL_FILTERS.map(({ key, label, icon }) => (
              <TriToggle
                key={key}
                label={label}
                icon={icon}
                state={boolStates[key] ?? null}
                onChange={newState => setBoolStates(prev => ({ ...prev, [key]: newState }))}
              />
            ))}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="active-filters-summary">
            <strong style={{ color: 'var(--moss)' }}>Active:</strong>{' '}
            {[
              ...Object.entries(nativeStates).filter(([, v]) => v !== null).map(([k, v]) => `${v ? '' : 'NOT '}${NATIVE_STATUS_LABELS[k]}`),
              ...Object.entries(durationStates).filter(([, v]) => v !== null).map(([k, v]) => `${v ? '' : 'NOT '}${DURATION_LABELS[k] || k}`),
              ...Object.entries(boolStates).filter(([, v]) => v !== null).map(([k, v]) => { const f = BOOL_FILTERS.find(f => f.key === k); return `${v ? '' : 'NOT '}${f?.label || k}` }),
            ].join(' · ')}
          </div>
        )}
      </div>

      {/* Grid */}
      {error && <div className="error">Error: {error}</div>}
      {loading && <div className="loading">Loading plants…</div>}
      {!loading && !error && plants.length === 0 && (
        <div className="loading">No plants found matching your criteria.</div>
      )}
      {!loading && !error && plants.length > 0 && (
        <div className="plant-grid">
          {plants.map(plant => <PlantCard key={plant.scientific_name} plant={plant} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Prev</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const pageNum = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 5 ? totalPages - 7 + i : page - 3 + i
            return (
              <button key={pageNum} className={page === pageNum ? 'active' : ''} onClick={() => setPage(pageNum)}>
                {pageNum + 1}
              </button>
            )
          })}
          <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next →</button>
        </div>
      )}
    </div>
  )
}
