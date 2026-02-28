import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Footer from './components/Footer'
import LandingPage from './pages/LandingPage'
import CategoryPage from './pages/CategoryPage'
import PlantDetailPage from './pages/PlantDetailPage'
import ScrapePage from './pages/ScrapePage'

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/plant/:scientificName" element={<PlantDetailPage />} />
          <Route path="/scrape-progress" element={<ScrapePage />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
