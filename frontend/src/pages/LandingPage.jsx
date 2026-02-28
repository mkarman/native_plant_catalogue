import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const CATEGORY_ICONS = {
  'Trees': '🌳',
  'Shrubs': '🌿',
  'Vines': '🌱',
  'Wildflowers & Herbs': '🌸',
  'Grasses & Sedges': '🌾',
  'Ferns': '🌿',
  'Mosses & Liverworts': '🍃',
  'Lichens': '🪨',
  'Other': '🌱',
}

export default function LandingPage() {
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/stats').then(r => r.json()),
    ])
      .then(([catData, statsData]) => {
        setCategories(catData.categories || [])
        setStats(statsData)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <h1 className="hero__title">
            Native Plants of<br />Fauquier County, Virginia
          </h1>
          <p className="hero__subtitle">
            A visual catalogue of native, introduced, and naturalized plant species
            documented in Fauquier County. Explore by plant type to discover the
            rich botanical diversity of the Virginia Piedmont.
          </p>
          {stats && (
            <div className="hero__stats">
              <div className="hero__stat">
                <span className="hero__stat-number">{stats.total_plants.toLocaleString()}</span>
                <span className="hero__stat-label">Total Species</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-number">{stats.native_plants.toLocaleString()}</span>
                <span className="hero__stat-label">Native Species</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-number">{stats.unique_families.toLocaleString()}</span>
                <span className="hero__stat-label">Plant Families</span>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-number">{stats.plants_with_images.toLocaleString()}</span>
                <span className="hero__stat-label">With Photos</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="container">
          <h2 className="section__title">Browse by Plant Type</h2>
          <p className="section__subtitle">
            Select a category to explore plants in that group
          </p>

          {loading && <div className="loading">Loading categories…</div>}
          {error && <div className="error">Could not load data: {error}</div>}

          {!loading && !error && (
            <div className="category-grid">
              {/* "All Plants" card */}
              <Link to="/category/all" className="category-card">
                <div className="category-card__image-placeholder">🌿</div>
                <div className="category-card__body">
                  <div className="category-card__name">All Plants</div>
                  <div className="category-card__count">
                    {stats ? `${stats.total_plants.toLocaleString()} species` : 'View all'}
                  </div>
                </div>
              </Link>

              {categories.map(cat => (
                <Link
                  key={cat.slug}
                  to={`/category/${cat.slug}`}
                  className="category-card"
                >
                  {cat.exemplar_image ? (
                    <img
                      className="category-card__image"
                      src={cat.exemplar_image}
                      alt={cat.name}
                      onError={e => {
                        e.target.style.display = 'none'
                        e.target.nextSibling && (e.target.nextSibling.style.display = 'flex')
                      }}
                    />
                  ) : null}
                  <div
                    className="category-card__image-placeholder"
                    style={{ display: cat.exemplar_image ? 'none' : 'flex' }}
                  >
                    {CATEGORY_ICONS[cat.name] || '🌱'}
                  </div>
                  <div className="category-card__body">
                    <div className="category-card__name">{cat.name}</div>
                    <div className="category-card__count">
                      {cat.count.toLocaleString()} species
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
