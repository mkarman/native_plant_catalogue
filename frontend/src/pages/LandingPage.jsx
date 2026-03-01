import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const CATEGORY_ICONS = {
  'Trees': '🌳', 'Shrubs': '🌿', 'Vines': '🌱',
  'Wildflowers & Herbs': '🌸', 'Grasses & Sedges': '🌾',
  'Ferns': '🌿', 'Mosses & Liverworts': '🍃', 'Other': '🌱',
}

function Particle() {
  const style = {
    position: 'absolute',
    width: (1 + Math.random() * 2) + 'px',
    height: (1 + Math.random() * 2) + 'px',
    background: 'var(--moss)',
    borderRadius: '50%',
    left: Math.random() * 100 + '%',
    animation: `float ${8 + Math.random() * 12}s linear ${Math.random() * 10}s infinite`,
    opacity: 0,
  }
  return <div style={style} />
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
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  return (
    <>
      <style>{`
        @keyframes float {
          0%   { opacity: 0; transform: translateY(100vh) translateX(0); }
          10%  { opacity: 0.5; }
          90%  { opacity: 0.2; }
          100% { opacity: 0; transform: translateY(-10vh) translateX(20px); }
        }
        @keyframes scroll-pulse {
          0%, 100% { opacity: 0.4; transform: scaleY(1); }
          50% { opacity: 1; transform: scaleY(1.2); }
        }
      `}</style>

      {/* Hero */}
      <section style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        padding: '0 3rem 6rem',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 70% 40%, rgba(61,102,48,0.2) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(29,48,24,0.35) 0%, transparent 50%), linear-gradient(to bottom, var(--forest-deep) 0%, var(--forest-dark) 40%, var(--forest-mid) 100%)',
      }}>
        {/* Particles */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {Array.from({ length: 20 }, (_, i) => <Particle key={i} />)}
        </div>

        {/* Hero content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 700 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
            fontSize: '0.7rem', fontWeight: 300, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '2rem',
          }}>
            <span style={{ display: 'block', width: '2.5rem', height: '1px', background: 'var(--moss)' }} />
            Native Plant Catalogue · Fauquier County, Virginia
          </div>

          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(3rem, 7vw, 5.5rem)',
            fontWeight: 300,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            color: 'var(--cream)',
            marginBottom: '2rem',
          }}>
            <span style={{ display: 'block', fontSize: '0.4em', fontWeight: 200, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--cream-dim)', marginBottom: '0.5rem' }}>
              Flora of the
            </span>
            Virginia<br />
            <span style={{ color: 'var(--moss)', fontStyle: 'italic' }}>Piedmont</span>
          </h1>

          <p style={{
            fontSize: '0.95rem', fontWeight: 200, color: 'var(--cream-dim)',
            maxWidth: 480, marginBottom: '3rem', lineHeight: 1.9,
          }}>
            A living record of native, introduced, and naturalized plants documented in Fauquier County — from ancient oaks to ephemeral wildflowers, mosses, and ferns.
          </p>

          <Link to="/category/all" style={{
            display: 'inline-flex', alignItems: 'center', gap: '1rem',
            padding: '0.9rem 2rem',
            border: '1px solid var(--leaf)',
            color: 'var(--cream)',
            fontSize: '0.8rem', fontWeight: 300, letterSpacing: '0.12em',
            textTransform: 'uppercase',
            transition: 'background 0.3s, border-color 0.3s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--forest-light)'; e.currentTarget.style.borderColor = 'var(--moss)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--leaf)' }}
          >
            Explore the Catalogue <span>→</span>
          </Link>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{
            position: 'absolute', right: '3rem', bottom: '6rem', zIndex: 2,
            display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'right',
          }}>
            {[
              { n: stats.total_plants.toLocaleString(), l: 'Species' },
              { n: stats.native_plants.toLocaleString(), l: 'Native' },
              { n: stats.unique_families.toLocaleString(), l: 'Families' },
            ].map(s => (
              <div key={s.l}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontWeight: 300, color: 'var(--cream)', display: 'block', lineHeight: 1 }}>{s.n}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 300, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--moss)', display: 'block', marginTop: '0.2rem' }}>{s.l}</span>
              </div>
            ))}
          </div>
        )}

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
          color: 'var(--cream-faint)', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, var(--moss), transparent)', animation: 'scroll-pulse 2s ease-in-out infinite' }} />
          <span>Scroll</span>
        </div>
      </section>

      <div className="divider" />

      {/* Categories section */}
      <section style={{ padding: '5rem 3rem', background: 'var(--forest-dark)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="section__eyebrow">Browse by growth form</div>
            <h2 className="section__title">Plant Categories</h2>
          </div>
          {stats && (
            <span style={{ fontSize: '0.8rem', fontWeight: 200, color: 'var(--cream-faint)', letterSpacing: '0.05em' }}>
              {categories.length} categories · {stats.total_plants.toLocaleString()} species
            </span>
          )}
        </div>

        {loading && <div className="loading">Entering the forest…</div>}
        {error && <div className="error">Could not load data: {error}</div>}

        {!loading && !error && (
          <>
            {/* All Plants card */}
            <div className="category-grid" style={{ marginBottom: 1 }}>
              <Link to="/category/all" className="category-card" style={{ height: 200 }}>
                <div className="category-card__image-placeholder" style={{ height: 200, fontSize: '5rem' }}>🌿</div>
                <div className="category-card__overlay">
                  <div className="category-card__number">00</div>
                  <div className="category-card__name">All Plants</div>
                  <div className="category-card__count">{stats ? `${stats.total_plants.toLocaleString()} species` : 'View all'}</div>
                </div>
                <div className="category-card__line" />
              </Link>
            </div>

            <div className="category-grid">
              {categories.map((cat, idx) => (
                <Link key={cat.slug} to={`/category/${cat.slug}`} className="category-card">
                  {cat.exemplar_image ? (
                    <img
                      className="category-card__image"
                      src={cat.exemplar_image}
                      alt={cat.name}
                      onError={e => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div
                    className="category-card__image-placeholder"
                    style={{ display: cat.exemplar_image ? 'none' : 'flex' }}
                  >
                    {CATEGORY_ICONS[cat.name] || '🌱'}
                  </div>
                  <div className="category-card__overlay">
                    <div className="category-card__number">0{idx + 1}</div>
                    <div className="category-card__name">{cat.name}</div>
                    <div className="category-card__count">{cat.count.toLocaleString()} species</div>
                  </div>
                  <div className="category-card__line" />
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}
