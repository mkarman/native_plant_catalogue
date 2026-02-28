import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

function AttrRow({ label, value }) {
  if (!value || value === 'None' || value === 'null' || value === 'false') return null
  return (
    <div className="plant-detail__attr">
      <label>{label}</label>
      <span>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 'var(--radius)',
      padding: '1.5rem',
      boxShadow: 'var(--shadow)',
      marginBottom: '1.5rem',
    }}>
      <h3 style={{
        fontFamily: 'var(--font-serif)',
        color: 'var(--green-dark)',
        fontSize: '1.1rem',
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid #f0f0f0',
      }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

export default function PlantDetailPage() {
  const { scientificName } = useParams()
  const navigate = useNavigate()
  const decodedName = decodeURIComponent(scientificName)

  const [plant, setPlant] = useState(null)
  const [images, setImages] = useState([])
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    const encodedName = encodeURIComponent(decodedName)

    Promise.all([
      fetch(`/api/plants/${encodedName}`).then(r => {
        if (!r.ok) throw new Error('Plant not found')
        return r.json()
      }),
      fetch(`/api/plants/${encodedName}/related`).then(r => r.json()).catch(() => ({ related: [] })),
    ])
      .then(([detail, relData]) => {
        setPlant(detail.plant)
        setImages(detail.images || [])
        setRelated(relData.related || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [decodedName])

  if (loading) return <div className="loading">Loading plant details…</div>
  if (error) return <div className="error">{error}</div>
  if (!plant) return null

  const commonName = plant.common_name || plant.scientific_name

  const nativeConfig = {
    N: { label: 'Native', bg: '#e8f5e9', color: '#2d5016' },
    I: { label: 'Introduced', bg: '#fff3e0', color: '#e65100' },
    U: { label: 'Status Unknown', bg: '#f3e5f5', color: '#6a1b9a' },
  }[plant.native_status] || null

  const iucnConfig = {
    LEAST_CONCERN: { label: 'Least Concern', color: '#2d5016' },
    NEAR_THREATENED: { label: 'Near Threatened', color: '#e65100' },
    VULNERABLE: { label: 'Vulnerable', color: '#f57c00' },
    ENDANGERED: { label: 'Endangered', color: '#c62828' },
    CRITICALLY_ENDANGERED: { label: 'Critically Endangered', color: '#b71c1c' },
  }[plant.iucn_threat_status] || null

  const habitSlug = plant.growth_habit_primary
    ? plant.growth_habit_primary.toLowerCase().replace(/\//g, '-').replace(/ /g, '-')
    : 'all'

  const boolVal = (v) => v === 'True' ? 'Yes' : v === 'False' ? 'No' : null

  return (
    <div className="plant-detail">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>›</span>
        <Link to={`/category/${habitSlug}`}>{plant.growth_habit_primary || 'Plants'}</Link>
        <span>›</span>
        <span>{commonName}</span>
      </div>

      {/* Back button */}
      <button className="btn-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      {/* Header */}
      <div className="plant-detail__header">
        <h1 className="plant-detail__common">{commonName}</h1>
        <p className="plant-detail__scientific">{plant.scientific_name}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {nativeConfig && (
            <span className="plant-card__badge" style={{ background: nativeConfig.bg, color: nativeConfig.color }}>
              {nativeConfig.label}
            </span>
          )}
          {iucnConfig && (
            <span className="plant-card__badge" style={{ background: '#f5f5f5', color: iucnConfig.color }}>
              IUCN: {iucnConfig.label}
            </span>
          )}
          {plant.duration && (
            <span className="plant-card__badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>
              {plant.duration}
            </span>
          )}
        </div>
      </div>

      {/* Images */}
      {images.length > 0 && (
        <div className="plant-detail__images">
          {images.map((img, i) => (
            <img
              key={i}
              className="plant-detail__image"
              src={img.url}
              alt={`${commonName} ${i + 1}`}
              loading="lazy"
              onError={e => { e.target.style.display = 'none' }}
            />
          ))}
        </div>
      )}

      {/* Wikipedia description */}
      {plant.wiki_summary && (
        <Section title="About">
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text-mid)' }}>
            {plant.wiki_summary}
          </p>
          {plant.height_m && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-light)' }}>
              Height: {plant.height_m}
            </p>
          )}
        </Section>
      )}

      {/* Ecology & Phenology */}
      {(plant.habitat_notes || plant.active_season || plant.peak_observation_months || plant.us_states) && (
        <Section title="Ecology & Range">
          {plant.habitat_notes && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Habitat</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-mid)', lineHeight: 1.6 }}>{plant.habitat_notes}</p>
            </div>
          )}
          {plant.active_season && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Active Season</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-mid)' }}>{plant.active_season}</p>
            </div>
          )}
          {plant.peak_observation_months && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Peak Observation Months</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-mid)' }}>{plant.peak_observation_months}</p>
            </div>
          )}
          {plant.us_states && (
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '0.25rem' }}>US Distribution</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-mid)' }}>{plant.us_states}</p>
            </div>
          )}
        </Section>
      )}

      {/* Taxonomy & Classification */}
      <Section title="Classification">
        <div className="plant-detail__attrs" style={{ boxShadow: 'none', padding: 0, background: 'transparent' }}>
          <AttrRow label="Kingdom" value={plant.kingdom} />
          <AttrRow label="Phylum" value={plant.phylum} />
          <AttrRow label="Class" value={plant.gbif_class} />
          <AttrRow label="Order" value={plant.gbif_order} />
          <AttrRow label="Family" value={plant.family} />
          <AttrRow label="Genus" value={plant.genus} />
          <AttrRow label="Plant Group" value={plant.plant_group} />
          <AttrRow label="USDA Symbol" value={plant.usda_symbol} />
        </div>
      </Section>

      {/* Ecological Value */}
      <Section title="Ecological Value">
        <div className="plant-detail__attrs" style={{ boxShadow: 'none', padding: 0, background: 'transparent' }}>
          <AttrRow label="Wildlife Value" value={boolVal(plant.has_wildlife_value)} />
          <AttrRow label="Pollinator Plant" value={boolVal(plant.has_pollinator_value)} />
          <AttrRow label="Wetland Species" value={boolVal(plant.has_wetland_data)} />
          <AttrRow label="IUCN Status" value={iucnConfig?.label} />
        </div>
        {!plant.has_wildlife_value && !plant.has_pollinator_value && !plant.has_wetland_data && !iucnConfig && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
            Ecological data not yet available for this species.
          </p>
        )}
      </Section>

      {/* External links */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
        {plant.usda_symbol && (
          <a
            href={`https://plants.usda.gov/plant-profile/${plant.usda_symbol}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--green-mid)', textDecoration: 'underline' }}
          >
            USDA PLANTS Database →
          </a>
        )}
        <a
          href={`https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(plant.scientific_name.split(' ').slice(0,2).join(' '))}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--green-mid)', textDecoration: 'underline' }}
        >
          iNaturalist →
        </a>
        <a
          href={`https://en.wikipedia.org/wiki/${encodeURIComponent(plant.scientific_name.split(' ').slice(0,2).join('_'))}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--green-mid)', textDecoration: 'underline' }}
        >
          Wikipedia →
        </a>
      </div>

      {/* Related plants */}
      {related.length > 0 && (
        <div className="related-section">
          <h3 className="section__title" style={{ fontSize: '1.25rem' }}>
            Related Plants
          </h3>
          <p className="section__subtitle">Same family or growth habit</p>
          <div className="related-grid">
            {related.map(r => (
              <Link
                key={r.scientific_name}
                to={`/plant/${encodeURIComponent(r.scientific_name)}`}
                className="plant-card"
              >
                {r.thumbnail ? (
                  <img
                    className="plant-card__image"
                    src={r.thumbnail}
                    alt={r.common_name || r.scientific_name}
                    loading="lazy"
                    onError={e => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div
                  className="plant-card__image-placeholder"
                  style={{ display: r.thumbnail ? 'none' : 'flex' }}
                >
                  🌿
                </div>
                <div className="plant-card__body">
                  <div className="plant-card__common">
                    {r.common_name || r.scientific_name}
                  </div>
                  <div className="plant-card__scientific">{r.scientific_name}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
