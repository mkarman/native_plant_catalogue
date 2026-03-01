export default function Footer() {
  return (
    <footer className="footer">
      <span>
        Data:{' '}
        <a href="https://plants.usda.gov" target="_blank" rel="noopener noreferrer">USDA PLANTS Database</a>
        {' · '}
        <a href="https://www.gbif.org" target="_blank" rel="noopener noreferrer">GBIF</a>
        {' · '}
        <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
      </span>
      <span>Fauquier County Native Plant Catalogue</span>
    </footer>
  )
}
