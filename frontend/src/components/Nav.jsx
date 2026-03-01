import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="nav">
      <Link to="/" className="nav__logo">
        Fauquier Native Plants
        <span>Virginia Piedmont Catalogue</span>
      </Link>
      <ul className="nav__links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/category/all">All Species</Link></li>
        <li><Link to="/scrape-progress">Data Status</Link></li>
      </ul>
    </nav>
  )
}
