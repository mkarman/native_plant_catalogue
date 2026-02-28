import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

function AttrRow({ label, value }) {
  if (!value || value === 'None' || value === 'null') return null
  return (
    <div className="plant-detail__attr">
      <label>{label}</label>
      <span>{value}</span>
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
  const nativeLabel = plant.native_status === 'N'
    ? 'Native'
    : plant.native_status === 'I'
      ? 'Introduced'
      : plant.native_status === 'U'
        ? 'Uncertain'
        : plant.native_status

  // Determine category slug for breadcrumb
  const habitSlug = plant.growth_habit_primary
    ? plant.growth_habit_primary.toLowerCase().replace(/\//g, '-').replace(/ /g, '-')
    : 'all'

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
        {nativeLabel && (
          <span className="plant-card__badge" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
            {nativeLabel}
          </span>
        )}
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

      {/* Attributes */}
      <div className="plant-detail__attrs">
        <AttrRow label="Common Name" value={plant.common_name} />
        <AttrRow label="Scientific Name" value={plant.scientific_name} />
        <AttrRow label="Native Status" value={nativeLabel} />
        <AttrRow label="County" value={plant.county} />
        <AttrRow label="Growth Habit" value={plant.growth_habit_primary} />
        <AttrRow label="Duration" value={plant.duration} />
        <AttrRow label="Plant Group" value={plant.plant_group} />
        <AttrRow label="Kingdom" value={plant.kingdom} />
        <AttrRow label="Phylum" value={plant.phylum} />
        <AttrRow label="Class" value={plant.gbif_class} />
        <AttrRow label="Order" value={plant.gbif_order} />
        <AttrRow label="Family" value={plant.family} />
        <AttrRow label="Genus" value={plant.genus} />
        <AttrRow label="USDA Symbol" value={plant.usda_symbol} />
        <AttrRow label="Has Wildlife Value" value={plant.has_wildlife_value === 'True' ? 'Yes' : plant.has_wildlife_value === 'False' ? 'No' : null} />
        <AttrRow label="Pollinator Value" value={plant.has_pollinator_value === 'True' ? 'Yes' : plant.has_pollinator_value === 'False' ? 'No' : null} />
        <AttrRow label="Wetland Species" value={plant.has_wetland_data === 'True' ? 'Yes' : plant.has_wetland_data === 'False' ? 'No' : null} />
      </div>

      {/* USDA link */}
      {plant.usda_symbol && (
        <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <a
            href={`https://plants.usda.gov/plant-profile/${plant.usda_symbol}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--green-mid)', textDecoration: 'underline' }}
          >
            View on USDA PLANTS Database →
          </a>
        </p>
      )}

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
