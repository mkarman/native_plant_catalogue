import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="nav">
      <div className="container nav__inner">
        <Link to="/" className="nav__logo">
          Fauquier Native Plants
          <span>Fauquier County, Virginia</span>
        </Link>
        <ul className="nav__links">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/category/all">All Plants</Link></li>
          <li><Link to="/scrape-progress">⏳ Scrape Progress</Link></li>
        </ul>
      </div>
    </nav>
  )
}
