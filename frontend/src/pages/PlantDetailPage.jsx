import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

function DetailAttr({ label, value }) {
  if (!value || value === 'None' || value === 'null' || value === 'false') return null
  return (
    <div className="detail-attr">
      <label>{label}</label>
      <span>{value}</span>
    </div>
  )
}

function DetailSection({ title, children }) {
  return (
    <div className="detail-section">
      <h3 className="detail-section__title">{title}</h3>
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
      fetch(`/api/plants/${encodedName}`).then(r => { if (!r.ok) throw new Error('Plant not found'); return r.json() }),
      fetch(`/api/plants/${encodedName}/related`).then(r => r.json()).catch(() => ({ related: [] })),
    ])
      .then(([detail, relData]) => {
        setPlant(detail.plant)
        setImages(detail.images || [])
        setRelated(relData.related || [])
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [decodedName])

  if (loading) return <div className="loading" style={{ paddingTop: '6rem' }}>Loading plant details…</div>
  if (error) return <div className="error" style={{ paddingTop: '6rem' }}>{error}</div>
  if (!plant) return null

  const commonName = plant.common_name || plant.scientific_name

  const nativeConfig = {
    N: { label: 'Native', cls: 'plant-card__badge badge--native' },
    I: { label: 'Introduced', cls: 'plant-card__badge badge--intro' },
    U: { label: 'Status Unknown', cls: 'plant-card__badge badge--unknown' },
  }[plant.native_status] || null

  const iucnConfig = {
    LEAST_CONCERN: { label: 'Least Concern', color: 'var(--moss)' },
    NEAR_THREATENED: { label: 'Near Threatened', color: '#d4a84a' },
    VULNERABLE: { label: 'Vulnerable', color: '#e07050' },
    ENDANGERED: { label: 'Endangered', color: '#c05030' },
    CRITICALLY_ENDANGERED: { label: 'Critically Endangered', color: '#a03020' },
  }[plant.iucn_threat_status] || null

  const habitSlug = plant.growth_habit_primary
    ? plant.growth_habit_primary.toLowerCase().replace(/\//g, '-').replace(/ /g, '-')
    : 'all'

  const boolVal = v => v === 'True' ? 'Yes' : v === 'False' ? 'No' : null

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

      {/* Back */}
      <button className="btn-back" onClick={() => navigate(-1)}>← Back</button>

      {/* Header */}
      <div className="plant-detail__header">
        <h1 className="plant-detail__common">{commonName}</h1>
        <p className="plant-detail__scientific">{plant.scientific_name}</p>
        <div className="plant-detail__badges">
          {nativeConfig && <span className={nativeConfig.cls}>{nativeConfig.label}</span>}
          {iucnConfig && (
            <span className="plant-card__badge" style={{ background: 'rgba(255,255,255,0.06)', color: iucnConfig.color, border: `1px solid ${iucnConfig.color}40` }}>
              IUCN: {iucnConfig.label}
            </span>
          )}
          {plant.duration && (
            <span className="plant-card__badge" style={{ background: 'rgba(122,170,90,0.1)', color: 'var(--fern)', border: '1px solid rgba(122,170,90,0.2)' }}>
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

      {/* About (Wikipedia) */}
      {plant.wiki_summary && (
        <DetailSection title="About">
          <p className="detail-text">{plant.wiki_summary}</p>
          {plant.height_m && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--cream-faint)' }}>Height: {plant.height_m}</p>
          )}
        </DetailSection>
      )}

      {/* Ecology & Range */}
      {(plant.habitat_notes || plant.active_season || plant.peak_observation_months || plant.us_states) && (
        <DetailSection title="Ecology & Range">
          {plant.habitat_notes && (
            <div className="detail-habitat-item">
              <label>Habitat</label>
              <p className="detail-text">{plant.habitat_notes}</p>
            </div>
          )}
          {plant.active_season && (
            <div className="detail-habitat-item">
              <label>Active Season</label>
              <p className="detail-text">{plant.active_season}</p>
            </div>
          )}
          {plant.peak_observation_months && (
            <div className="detail-habitat-item">
              <label>Peak Observation Months</label>
              <p className="detail-text">{plant.peak_observation_months}</p>
            </div>
          )}
          {plant.us_states && (
            <div className="detail-habitat-item">
              <label>US Distribution</label>
              <p className="detail-text" style={{ fontSize: '0.85rem' }}>{plant.us_states}</p>
            </div>
          )}
        </DetailSection>
      )}

      {/* Classification */}
      <DetailSection title="Classification">
        <div className="detail-attrs">
          <DetailAttr label="Kingdom" value={plant.kingdom} />
          <DetailAttr label="Phylum" value={plant.phylum} />
          <DetailAttr label="Class" value={plant.gbif_class} />
          <DetailAttr label="Order" value={plant.gbif_order} />
          <DetailAttr label="Family" value={plant.family} />
          <DetailAttr label="Genus" value={plant.genus} />
          <DetailAttr label="Plant Group" value={plant.plant_group} />
          <DetailAttr label="Growth Habit" value={plant.growth_habit_primary} />
          <DetailAttr label="USDA Symbol" value={plant.usda_symbol} />
        </div>
      </DetailSection>

      {/* Ecological Value */}
      <DetailSection title="Ecological Value">
        <div className="detail-attrs">
          <DetailAttr label="Wildlife Value" value={boolVal(plant.has_wildlife_value)} />
          <DetailAttr label="Pollinator Plant" value={boolVal(plant.has_pollinator_value)} />
          <DetailAttr label="Wetland Species" value={boolVal(plant.has_wetland_data)} />
          <DetailAttr label="IUCN Status" value={iucnConfig?.label} />
        </div>
        {!plant.has_wildlife_value && !plant.has_pollinator_value && !plant.has_wetland_data && !iucnConfig && (
          <p style={{ fontSize: '0.8rem', color: 'var(--cream-faint)', fontStyle: 'italic', fontWeight: 200 }}>
            Ecological data not yet available for this species.
          </p>
        )}
      </DetailSection>

      {/* External links */}
      <div className="external-links">
        {plant.usda_symbol && (
          <a href={`https://plants.usda.gov/plant-profile/${plant.usda_symbol}`} target="_blank" rel="noopener noreferrer" className="external-link">
            USDA PLANTS →
          </a>
        )}
        <a
          href={`https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(plant.scientific_name.split(' ').slice(0,2).join(' '))}`}
          target="_blank" rel="noopener noreferrer" className="external-link"
        >
          iNaturalist →
        </a>
        <a
          href={`https://en.wikipedia.org/wiki/${encodeURIComponent(plant.scientific_name.split(' ').slice(0,2).join('_'))}`}
          target="_blank" rel="noopener noreferrer" className="external-link"
        >
          Wikipedia →
        </a>
      </div>

      {/* Related plants */}
      {related.length > 0 && (
        <div className="related-section">
          <div className="section__eyebrow">Same family or growth habit</div>
          <h3 className="section__title" style={{ fontSize: '1.5rem' }}>Related Plants</h3>
          <div className="related-grid">
            {related.map(r => (
              <Link key={r.scientific_name} to={`/plant/${encodeURIComponent(r.scientific_name)}`} className="plant-card">
                {r.thumbnail ? (
                  <img
                    className="plant-card__image"
                    src={r.thumbnail}
                    alt={r.common_name || r.scientific_name}
                    loading="lazy"
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                  />
                ) : null}
                <div className="plant-card__image-placeholder" style={{ display: r.thumbnail ? 'none' : 'flex' }}>🌿</div>
                <div className="plant-card__body">
                  <div className="plant-card__common">{r.common_name || r.scientific_name}</div>
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
