import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

function ProgressBar({ percent, color = 'var(--green-mid)' }) {
  return (
    <div style={{
      background: '#e0e0e0',
      borderRadius: '999px',
      height: '12px',
      overflow: 'hidden',
      margin: '0.4rem 0 0.75rem',
    }}>
      <div style={{
        width: `${Math.min(percent, 100)}%`,
        height: '100%',
        background: color,
        borderRadius: '999px',
        transition: 'width 0.6s ease',
      }} />
    </div>
  )
}

export default function ScrapePage() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetchProgress = () => {
    fetch('/api/scrape/progress')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setHistory(prev => {
          const now = new Date().toLocaleTimeString()
          const entry = {
            time: now,
            gbif: d.gbif_enriched,
            usda: d.usda_enriched,
            images: d.plants_with_images,
            chars: d.characteristics_enriched || 0,
          }
          return [...prev.slice(-19), entry]
        })
        setError(null)
        if (d.complete) {
          clearInterval(intervalRef.current)
        }
      })
      .catch(err => setError(err.message))
  }

  useEffect(() => {
    fetchProgress()
    intervalRef.current = setInterval(fetchProgress, 5000)
    return () => clearInterval(intervalRef.current)
  }, [])

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 800 }}>
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span>›</span>
          <span>Scrape Progress</span>
        </div>

        <h2 className="section__title">Data Enrichment Progress</h2>
        <p className="section__subtitle">
          Auto-refreshes every 5 seconds &mdash; scraping USDA, GBIF, Wikipedia, and Wikimedia Commons
        </p>

        {error && <div className="error">API error: {error}</div>}

        {data && (
          <>
            {/* Status badge */}
            <div style={{
              display: 'inline-block',
              padding: '0.3rem 1rem',
              borderRadius: '999px',
              background: data.complete ? '#e8f5e9' : '#fff3e0',
              color: data.complete ? 'var(--green-dark)' : '#e65100',
              fontWeight: 600,
              fontSize: '0.85rem',
              marginBottom: '1.5rem',
            }}>
              {data.complete ? 'Complete' : 'Running…'}
            </div>

            {/* Progress cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}>
              {[
                { label: 'Total Plants', value: data.total_plants.toLocaleString(), color: 'var(--green-dark)' },
                { label: 'USDA Enriched', value: `${data.usda_enriched.toLocaleString()} (${data.usda_percent}%)`, color: 'var(--green-mid)' },
                { label: 'GBIF Taxonomy', value: `${data.gbif_enriched.toLocaleString()} (${data.gbif_percent}%)`, color: '#1565c0' },
                { label: 'Plants w/ Images', value: `${data.plants_with_images.toLocaleString()} (${data.images_percent}%)`, color: '#6a1b9a' },
                { label: 'Total Images', value: data.total_images_downloaded.toLocaleString(), color: '#4e342e' },
                { label: 'Characteristics', value: `${(data.characteristics_enriched || 0).toLocaleString()} (${data.characteristics_percent || 0}%)`, color: '#00695c' },
              ].map(card => (
                <div key={card.label} style={{
                  background: 'white',
                  borderRadius: 'var(--radius)',
                  padding: '1.25rem',
                  boxShadow: 'var(--shadow)',
                }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)', marginBottom: '0.4rem' }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: card.color, fontFamily: 'var(--font-serif)' }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bars */}
            <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: '1.5rem', boxShadow: 'var(--shadow)', marginBottom: '2rem' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--green-dark)', marginBottom: '1rem' }}>Enrichment Progress</h3>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>USDA Plant Profiles (growth habit, taxonomy, duration)</span>
                  <strong>{data.usda_percent}%</strong>
                </div>
                <ProgressBar percent={data.usda_percent} color="var(--green-mid)" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>GBIF Taxonomy (phylum, class, order, family)</span>
                  <strong>{data.gbif_percent}%</strong>
                </div>
                <ProgressBar percent={data.gbif_percent} color="#1565c0" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Plant Images (Wikimedia Commons)</span>
                  <strong>{data.images_percent}%</strong>
                </div>
                <ProgressBar percent={data.images_percent} color="#6a1b9a" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Characteristics (Wikipedia, GBIF phenology, IUCN status)</span>
                  <strong>{data.characteristics_percent || 0}%</strong>
                </div>
                <ProgressBar percent={data.characteristics_percent || 0} color="#00695c" />
              </div>
            </div>

            {/* Activity log */}
            {history.length > 1 && (
              <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: '1.5rem', boxShadow: 'var(--shadow)', marginBottom: '2rem' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--green-dark)', marginBottom: '1rem' }}>Activity Log</h3>
                <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {[...history].reverse().map((h, i) => (
                    <div key={i} style={{ padding: '0.2rem 0', borderBottom: '1px solid #f0f0f0', color: i === 0 ? 'var(--green-dark)' : 'var(--text-mid)' }}>
                      <span style={{ color: 'var(--text-light)', marginRight: '1rem' }}>{h.time}</span>
                      USDA: {h.usda} | GBIF: {h.gbif} | Images: {h.images} | Chars: {h.chars}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent plants */}
            {data.recent_plants && data.recent_plants.length > 0 && (
              <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: '1.5rem', boxShadow: 'var(--shadow)' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--green-dark)', marginBottom: '1rem' }}>Recently Enriched</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #eee' }}>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-light)' }}>Scientific Name</th>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-light)' }}>Growth Habit</th>
                      <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-light)' }}>Family</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_plants.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '0.4rem 0.5rem', fontStyle: 'italic' }}>{p.name}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{p.habit || '—'}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{p.family || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
