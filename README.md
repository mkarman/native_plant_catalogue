# Native Plant Catalogue — Fauquier County, Virginia

A visual, searchable catalogue of native, introduced, and naturalized plant species documented in Fauquier County, Virginia. Plants are organized by growth habit (trees, shrubs, wildflowers, grasses, ferns, mosses) and enriched with taxonomy, images, and ecological attributes sourced from authoritative botanical databases.

---

## Data Sources

### Plant Lists
- **Fauquier County Plant Records** (`91v.csv`, `91b.csv`) — Vascular plants and bryophytes (mosses, liverworts) documented in Fauquier County, with scientific name, common name, and native status (N = Native, I = Introduced, U = Uncertain).

### Taxonomic & Attribute Enrichment
- **[USDA PLANTS Database](https://plants.usda.gov)** — The authoritative U.S. government database for plant taxonomy and characteristics. Used via the `plantsservices.sc.egov.usda.gov` API to retrieve:
  - Growth habits (Tree, Shrub, Forb/herb, Graminoid, Vine, Fern, Nonvascular)
  - Duration (Perennial, Annual, Biennial)
  - Taxonomic hierarchy (Kingdom → Family → Genus)
  - Wildlife value, pollinator value, wetland status
  - USDA plant symbols for cross-referencing

- **[GBIF — Global Biodiversity Information Facility](https://www.gbif.org)** — An international open-access biodiversity data infrastructure. Used via the [GBIF Species API](https://api.gbif.org/v1/species) to retrieve:
  - Full taxonomic classification (Kingdom, Phylum, Class, Order, Family, Genus)
  - Accepted scientific names and synonyms

- **[USDA SearchResults](https://plants.usda.gov)** — A bulk symbol lookup file (`SearchResults.csv`) mapping accepted and synonym USDA symbols to scientific names, used to cross-reference the county plant lists with USDA records.

### Images
- **[Wikimedia Commons](https://commons.wikimedia.org)** — Free, openly licensed botanical photographs retrieved via the [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page), searched by scientific name for accuracy. Images are stored locally and served via the application.

---

## Architecture

```
native_plant_catalogue/
├── docker-compose.yml          # Orchestrates all services
├── backend/
│   ├── main.py                 # FastAPI REST API
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx     # Category grid with exemplar images
│   │   │   ├── CategoryPage.jsx    # Thumbnail grid with search & filter
│   │   │   ├── PlantDetailPage.jsx # Full plant detail with taxonomy
│   │   │   └── ScrapePage.jsx      # Live data enrichment progress
│   │   └── components/
│   ├── nginx.conf
│   └── Dockerfile
├── populate_neo4j.py           # Seeds Neo4j from CSV files
├── scraper.py                  # Enriches plants via USDA + GBIF + Wikimedia
├── enrich_usda.py              # Targeted USDA-only enrichment
├── images/                     # Downloaded plant images (gitignored)
└── plans/                      # Architecture and deployment documentation
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Database | [Neo4j](https://neo4j.com) — graph database enabling plant relationship visualization |
| Backend | [FastAPI](https://fastapi.tiangolo.com) — Python REST API |
| Frontend | [React](https://react.dev) + [Vite](https://vitejs.dev) |
| Serving | [nginx](https://nginx.org) (production), Vite dev server (development) |
| Containerization | [Docker](https://docker.com) + Docker Compose |

---

## Running Locally

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Python 3.12+](https://www.python.org/downloads/)
- [Node.js 20+](https://nodejs.org/)

### Quick Start

```bash
# 1. Build and start all services
docker compose up -d

# 2. Seed the database with plant records
python populate_neo4j.py

# 3. Enrich with USDA growth habits and taxonomy
python enrich_usda.py

# 4. Download images and GBIF taxonomy (runs in background, takes ~30–60 min)
python scraper.py

# 5. Build the frontend
cd frontend && npm install && npm run build
docker compose up --build -d frontend
```

### Access Points

| Service | URL |
|---------|-----|
| Plant Catalogue | http://localhost:3000 |
| Scrape Progress | http://localhost:3000/scrape-progress |
| FastAPI Backend | http://localhost:8000 |
| API Documentation | http://localhost:8000/docs |
| Neo4j Browser | http://localhost:7474 |

**Neo4j credentials:** `neo4j` / `plantcatalogue`

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Summary statistics (total plants, native count, families, images) |
| `GET /api/categories` | Plant categories with counts and exemplar images |
| `GET /api/plants` | Paginated plant list with optional filters: `category`, `native_only`, `search` |
| `GET /api/plants/{scientific_name}` | Full plant detail with all images |
| `GET /api/plants/{scientific_name}/related` | Related plants by family or growth habit |
| `GET /api/scrape/progress` | Live enrichment progress from Neo4j |

---

## Data Enrichment Pipeline

```
CSV Files (91v.csv, 91b.csv)
        │
        ▼
populate_neo4j.py ──► Neo4j Plant nodes (scientific name, common name, native status)
        │
        ▼
SearchResults.csv ──► USDA symbol linking (prefix-matched to plant nodes)
        │
        ▼
enrich_usda.py ──► USDA PlantProfile API ──► growth_habit, duration, family, taxonomy
        │
        ▼
scraper.py ──► GBIF Species API ──► phylum, class, order, family
           └──► Wikimedia Commons API ──► plant images → images/ directory
```

---

## Plant Categories

Categories are derived automatically from USDA `GrowthHabits` values:

| Category | USDA Growth Habit |
|----------|------------------|
| Trees | Tree |
| Shrubs | Shrub, Subshrub |
| Vines | Vine |
| Wildflowers & Herbs | Forb/herb |
| Grasses & Sedges | Graminoid |
| Ferns | Fern |
| Mosses & Liverworts | Nonvascular |
| Lichens | Lichenous |

---

## Deployment

See [`plans/aws-deployment-cost-estimate.md`](plans/aws-deployment-cost-estimate.md) for a full AWS deployment cost analysis. The recommended production architecture is:

- **ECS Fargate** — FastAPI container (~$15–18/month)
- **Neo4j AuraDB Free** — Managed graph database ($0, supports up to 200K nodes)
- **S3 + CloudFront** — React frontend and plant images (~$2/month)
- **Total: ~$18–21/month**

---

## License

Plant data sourced from USDA PLANTS Database and GBIF is publicly available under their respective open data policies. Images sourced from Wikimedia Commons are individually licensed (typically CC BY-SA or public domain) — see each image's source URL for specific licensing.

This application code is provided for educational and conservation purposes.

---

## Acknowledgments

- [USDA Natural Resources Conservation Service](https://www.nrcs.usda.gov) — PLANTS Database
- [Global Biodiversity Information Facility (GBIF)](https://www.gbif.org)
- [Wikimedia Commons](https://commons.wikimedia.org) contributors
- Fauquier County plant survey contributors
