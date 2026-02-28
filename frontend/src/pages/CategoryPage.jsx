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

// Duration values → friendly display names
const DURATION_LABELS = {
  'Perennial': 'Perennial',
  'Annual': 'Annual',
  'Biennial': 'Biennial',
}

// Native status values → friendly display names
const NATIVE_STATUS_LABELS = {
  'N': 'Native',
  'I': 'Introduced',
  'U': 'Status Unknown',
}

// Boolean filter definitions
const BOOL_FILTERS = [
  { key: 'wildlife', label: 'Wildlife Value', icon: '🦋' },
  { key: 'pollinator', label: 'Pollinator Plant', icon: '🐝' },
  { key: 'wetland', label: 'Wetland Species', icon: '💧' },
]

/**
 * Tri-state toggle chip.
 * state: null → unset (grey)
 *        true  → include (green, ✓)
 *        false → exclude (red, ✗)
 * Cycle: null → true → false → null
 */
function TriToggle({ label, icon, state, onChange }) {
  const handleClick = () => {
    if (state === null) onChange(true)
    else if (state === true) onChange(false)
    else onChange(null)
  }

  const styles = {
    null: {
      background: '#f0f0f0',
      color: '#666',
      border: '1.5px solid #ddd',
    },
    true: {
      background: '#e8f5e9',
      color: '#2d5016',
      border: '1.5px solid #7ab648',
    },
    false: {
      background: '#fce4ec',
      color: '#b71c1c',
      border: '1.5px solid #ef9a9a',
    },
  }

  const indicators = { null: '', true: ' ✓', false: ' ✗' }
  const stateKey = state === null ? 'null' : state.toString()

  return (
    <button
      onClick={handleClick}
      title={
        state === null
          ? `Click to show only plants with ${label}`
          : state === true
            ? `Click to exclude plants with ${label}`
            : `Click to clear ${label} filter`
      }
      style={{
        ...styles[stateKey],
        padding: '0.35rem 0.75rem',
        borderRadius: '999px',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 500,
        fontFamily: 'var(--font-sans)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {icon && <span>{icon}</span>}
      {label}{indicators[stateKey]}
    </button>
  )
}

/**
 * Multi-value tri-state toggle for sets (native status, duration).
 * Each value cycles: unset → include → exclude → unset
 */
function MultiTriToggle({ values, labelMap, iconMap = {}, states, onChange }) {
  return (
    <>
      {values.map(val => (
        <TriToggle
          key={val}
          label={labelMap[val] || val}
          icon={iconMap[val]}
          state={states[val] ?? null}
          onChange={newState => onChange(val, newState)}
        />
      ))}
    </>
  )
}

function FilterSection({ title, children }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-light)',
        marginBottom: '0.4rem',
        fontWeight: 600,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {children}
      </div>
    </div>
  )
}

function PlantCard({ plant }) {
  const displayName = plant.common_name || plant.scientific_name
  const sciName = plant.scientific_name
  const encodedName = encodeURIComponent(sciName)

  const nativeLabel = {
    'N': { text: 'Native', bg: '#e8f5e9', color: '#2d5016' },
    'I': { text: 'Introduced', bg: '#fff3e0', color: '#e65100' },
    'U': { text: 'Unknown', bg: '#f3e5f5', color: '#6a1b9a' },
  }[plant.native_status]

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
        {nativeLabel && (
          <span
            className="plant-card__badge"
            style={{ background: nativeLabel.bg, color: nativeLabel.color }}
          >
            {nativeLabel.text}
          </span>
        )}
      </div>
    </Link>
  )
}

// Build query params from filter state
function buildFilterParams({ page, slug, search, nativeStates, durationStates, boolStates }) {
  const params = new URLSearchParams({
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  })

  if (slug !== 'all') params.set('category', slug)
  if (search.trim()) params.set('search', search.trim())

  // Native status: collect includes and excludes
  const nativeIncludes = Object.entries(nativeStates).filter(([, v]) => v === true).map(([k]) => k)
  const nativeExcludes = Object.entries(nativeStates).filter(([, v]) => v === false).map(([k]) => k)
  if (nativeIncludes.length > 0) params.set('native_status', nativeIncludes.join(','))
  else if (nativeExcludes.length > 0) params.set('native_status', '!' + nativeExcludes.join(','))

  // Duration: collect includes and excludes
  const durIncludes = Object.entries(durationStates).filter(([, v]) => v === true).map(([k]) => k)
  const durExcludes = Object.entries(durationStates).filter(([, v]) => v === false).map(([k]) => k)
  if (durIncludes.length > 0) params.set('duration', durIncludes.join(','))
  else if (durExcludes.length > 0) params.set('duration', '!' + durExcludes.join(','))

  // Boolean filters
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

  // Tri-state filter maps: key → null | true | false
  const [nativeStates, setNativeStates] = useState({})
  const [durationStates, setDurationStates] = useState({})
  const [boolStates, setBoolStates] = useState({})

  const categoryLabel = CATEGORY_LABELS[slug] || slug

  // Load available duration values
  useEffect(() => {
    fetch('/api/filter-options')
      .then(r => r.json())
      .then(data => setDurations(data.durations || []))
      .catch(() => setDurations(['Perennial', 'Annual', 'Biennial']))
  }, [])

  const fetchPlants = useCallback(() => {
    setLoading(true)
    const params = buildFilterParams({ page, slug, search, nativeStates, durationStates, boolStates })

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
  }, [slug, page, search, nativeStates, durationStates, boolStates])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [slug, search, nativeStates, durationStates, boolStates])

  useEffect(() => {
    fetchPlants()
  }, [fetchPlants])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const hasActiveFilters =
    Object.values(nativeStates).some(v => v !== null) ||
    Object.values(durationStates).some(v => v !== null) ||
    Object.values(boolStates).some(v => v !== null)

  const clearAllFilters = () => {
    setNativeStates({})
    setDurationStates({})
    setBoolStates({})
    setSearch('')
  }

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
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              style={{
                marginLeft: '1rem',
                fontSize: '0.78rem',
                color: 'var(--green-mid)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Clear all filters
            </button>
          )}
        </p>

        {/* Search bar */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            className="search-input"
            type="search"
            placeholder="Search by common or scientific name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', maxWidth: '480px' }}
          />
        </div>

        {/* Filter chips */}
        <div style={{
          background: 'white',
          borderRadius: 'var(--radius)',
          padding: '1rem 1.25rem',
          boxShadow: 'var(--shadow)',
          marginBottom: '1.5rem',
        }}>
          <FilterSection title="Origin">
            <MultiTriToggle
              values={['N', 'I', 'U']}
              labelMap={NATIVE_STATUS_LABELS}
              iconMap={{ N: '🌿', I: '⚠️', U: '❓' }}
              states={nativeStates}
              onChange={(val, newState) =>
                setNativeStates(prev => ({ ...prev, [val]: newState }))
              }
            />
          </FilterSection>

          <FilterSection title="Life Cycle">
            <MultiTriToggle
              values={durations.length > 0 ? durations : ['Perennial', 'Annual', 'Biennial']}
              labelMap={DURATION_LABELS}
              iconMap={{ Perennial: '🔄', Annual: '1️⃣', Biennial: '2️⃣' }}
              states={durationStates}
              onChange={(val, newState) =>
                setDurationStates(prev => ({ ...prev, [val]: newState }))
              }
            />
          </FilterSection>

          <FilterSection title="Ecological Value">
            {BOOL_FILTERS.map(({ key, label, icon }) => (
              <TriToggle
                key={key}
                label={label}
                icon={icon}
                state={boolStates[key] ?? null}
                onChange={newState =>
                  setBoolStates(prev => ({ ...prev, [key]: newState }))
                }
              />
            ))}
          </FilterSection>

          {hasActiveFilters && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-light)' }}>
              <strong>Active:</strong>{' '}
              {[
                ...Object.entries(nativeStates)
                  .filter(([, v]) => v !== null)
                  .map(([k, v]) => `${v ? '' : 'NOT '}${NATIVE_STATUS_LABELS[k]}`),
                ...Object.entries(durationStates)
                  .filter(([, v]) => v !== null)
                  .map(([k, v]) => `${v ? '' : 'NOT '}${DURATION_LABELS[k] || k}`),
                ...Object.entries(boolStates)
                  .filter(([, v]) => v !== null)
                  .map(([k, v]) => {
                    const f = BOOL_FILTERS.find(f => f.key === k)
                    return `${v ? '' : 'NOT '}${f?.label || k}`
                  }),
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
