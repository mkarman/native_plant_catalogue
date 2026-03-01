import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

function ProgressBar({ percent, color = 'var(--moss)' }) {
  return (
    <div className="progress-bar-wrap">
      <div
        className="progress-bar-fill"
        style={{ width: `${Math.min(percent, 100)}%`, background: color }}
      />
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
          return [...prev.slice(-19), {
            time: now,
            gbif: d.gbif_enriched,
            usda: d.usda_enriched,
            images: d.plants_with_images,
            chars: d.characteristics_enriched || 0,
          }]
        })
        setError(null)
        if (d.complete) clearInterval(intervalRef.current)
      })
      .catch(err => setError(err.message))
  }

  useEffect(() => {
    fetchProgress()
    intervalRef.current = setInterval(fetchProgress, 5000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const bars = data ? [
    { label: 'USDA Plant Profiles', sublabel: 'growth habit, taxonomy, duration', pct: data.usda_percent, color: 'var(--moss)', val: data.usda_enriched },
    { label: 'GBIF Taxonomy', sublabel: 'phylum, class, order, family', pct: data.gbif_percent, color: '#5a9ad4', val: data.gbif_enriched },
    { label: 'Plant Images', sublabel: 'Wikimedia Commons', pct: data.images_percent, color: '#9a7ad4', val: data.plants_with_images },
    { label: 'Characteristics', sublabel: 'Wikipedia, GBIF phenology, IUCN status', pct: data.characteristics_percent || 0, color: 'var(--gold)', val: data.characteristics_enriched || 0 },
  ] : []

  return (
    <div style={{ padding: '3rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>›</span>
        <span>Data Enrichment Status</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div className="section__eyebrow">Live status</div>
        <h1 className="section__title">Data Enrichment Progress</h1>
        <p className="section__subtitle">Auto-refreshes every 5 seconds</p>
      </div>

      {error && <div className="error">API error: {error}</div>}

      {data && (
        <>
          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.35rem 1rem',
            border: `1px solid ${data.complete ? 'rgba(122,170,90,0.4)' : 'rgba(212,168,74,0.4)'}`,
            color: data.complete ? 'var(--moss)' : 'var(--gold)',
            fontSize: '0.75rem', fontWeight: 300, letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: '2rem',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: data.complete ? 'var(--moss)' : 'var(--gold)', animation: data.complete ? 'none' : 'pulse 1.5s ease-in-out infinite' }} />
            {data.complete ? 'Complete' : 'Running'}
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1px', background: 'var(--forest-light)', marginBottom: '2rem' }}>
            {[
              { label: 'Total Plants', value: data.total_plants.toLocaleString(), color: 'var(--cream)' },
              { label: 'USDA Enriched', value: `${data.usda_enriched} (${data.usda_percent}%)`, color: 'var(--moss)' },
              { label: 'GBIF Taxonomy', value: `${data.gbif_enriched} (${data.gbif_percent}%)`, color: '#5a9ad4' },
              { label: 'With Images', value: `${data.plants_with_images} (${data.images_percent}%)`, color: '#9a7ad4' },
              { label: 'Total Images', value: data.total_images_downloaded.toLocaleString(), color: 'var(--cream-dim)' },
              { label: 'Characteristics', value: `${data.characteristics_enriched || 0} (${data.characteristics_percent || 0}%)`, color: 'var(--gold)' },
            ].map(card => (
              <div key={card.label} className="stat-card">
                <div className="stat-card__label">{card.label}</div>
                <div className="stat-card__value" style={{ color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Progress bars */}
          <div className="detail-section" style={{ marginBottom: '1.5rem' }}>
            <h3 className="detail-section__title">Enrichment Progress</h3>
            {bars.map(bar => (
              <div key={bar.label} style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--cream-dim)', fontWeight: 300 }}>
                    {bar.label}
                    <span style={{ color: 'var(--cream-faint)', marginLeft: '0.5rem', fontSize: '0.7rem' }}>— {bar.sublabel}</span>
                  </span>
                  <strong style={{ color: bar.color, fontWeight: 400 }}>{bar.pct}%</strong>
                </div>
                <ProgressBar percent={bar.pct} color={bar.color} />
              </div>
            ))}
          </div>

          {/* Activity log */}
          {history.length > 1 && (
            <div className="detail-section" style={{ marginBottom: '1.5rem' }}>
              <h3 className="detail-section__title">Activity Log</h3>
              <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                {[...history].reverse().map((h, i) => (
                  <div key={i} style={{
                    padding: '0.25rem 0',
                    borderBottom: '1px solid var(--forest-light)',
                    color: i === 0 ? 'var(--cream)' : 'var(--cream-faint)',
                    display: 'flex', gap: '1rem',
                  }}>
                    <span style={{ color: 'var(--cream-faint)', minWidth: '5rem' }}>{h.time}</span>
                    <span>USDA: <span style={{ color: 'var(--moss)' }}>{h.usda}</span></span>
                    <span>GBIF: <span style={{ color: '#5a9ad4' }}>{h.gbif}</span></span>
                    <span>Images: <span style={{ color: '#9a7ad4' }}>{h.images}</span></span>
                    <span>Chars: <span style={{ color: 'var(--gold)' }}>{h.chars}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recently enriched */}
          {data.recent_plants && data.recent_plants.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section__title">Recently Enriched</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--forest-light)' }}>
                    {['Scientific Name', 'Growth Habit', 'Family'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--cream-faint)', fontWeight: 300, fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_plants.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.4rem 0.5rem', fontStyle: 'italic', color: 'var(--cream-dim)', fontWeight: 200 }}>{p.name}</td>
                      <td style={{ padding: '0.4rem 0.5rem', color: 'var(--moss)', fontWeight: 200 }}>{p.habit || '—'}</td>
                      <td style={{ padding: '0.4rem 0.5rem', color: 'var(--cream-faint)', fontWeight: 200 }}>{p.family || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
