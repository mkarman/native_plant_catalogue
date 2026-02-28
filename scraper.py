"""
Plant Data Enrichment Scraper
=============================
Iterates through all Plant nodes in Neo4j, fetches enrichment data from:
  1. USDA PlantProfile API  - growth habits, durations, group, taxonomy ancestors
  2. GBIF Species API       - kingdom, phylum, class, order, family, genus
  3. Wikimedia Commons API  - plant images searched by scientific name

Stores all results back into Neo4j as node properties and Image nodes.
"""

import time
import os
import re
import requests
from neo4j import GraphDatabase

# ── Config ────────────────────────────────────────────────────────────────────
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "plantcatalogue"

IMAGE_DIR = "images"
REQUEST_DELAY = 0.5   # seconds between API calls

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

USDA_API = "https://plantsservices.sc.egov.usda.gov/api/PlantProfile"
GBIF_API = "https://api.gbif.org/v1/species"
WIKI_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"


# ── Neo4j helpers ─────────────────────────────────────────────────────────────
class Neo4jDatabase:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def get_all_plants(self):
        with self.driver.session() as session:
            result = session.run(
                "MATCH (p:Plant) "
                "RETURN p.scientific_name AS scientific_name, "
                "       p.usda_symbol AS usda_symbol, "
                "       p.common_name AS common_name"
            )
            return [dict(r) for r in result]

    def update_plant(self, scientific_name: str, props: dict):
        if not props:
            return
        with self.driver.session() as session:
            session.execute_write(self._set_props, scientific_name, props)

    @staticmethod
    def _set_props(tx, scientific_name, props):
        set_parts = []
        for k in props:
            safe = re.sub(r"[^a-zA-Z0-9_]", "_", k)[:50]
            set_parts.append(f"p.{safe} = ${safe}")
        params = {re.sub(r"[^a-zA-Z0-9_]", "_", k)[:50]: v for k, v in props.items()}
        params["scientific_name"] = scientific_name
        query = (
            f"MATCH (p:Plant {{scientific_name: $scientific_name}}) "
            f"SET {', '.join(set_parts)}"
        )
        tx.run(query, **params)

    def store_image(self, scientific_name: str, image_url: str, local_path: str, source: str):
        with self.driver.session() as session:
            session.execute_write(
                self._add_image_node, scientific_name, image_url, local_path, source
            )

    @staticmethod
    def _add_image_node(tx, scientific_name, image_url, local_path, source):
        tx.run(
            "MATCH (p:Plant {scientific_name: $sci}) "
            "MERGE (i:Image {url: $url}) "
            "SET i.local_path = $path, i.source = $source "
            "MERGE (p)-[:HAS_IMAGE]->(i)",
            sci=scientific_name, url=image_url, path=local_path, source=source
        )


# ── API fetchers ──────────────────────────────────────────────────────────────
def safe_get(url, params=None, retries=3, delay=2):
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, headers=BROWSER_HEADERS, timeout=20)
            if r.status_code == 200:
                return r
            elif r.status_code == 404:
                return None
        except requests.RequestException as e:
            print(f"    Retry {attempt+1}/{retries}: {e}")
            time.sleep(delay)
    return None


def fetch_usda_profile(symbol: str) -> dict:
    """Fetch USDA PlantProfile and extract useful fields."""
    r = safe_get(USDA_API, params={"symbol": symbol})
    if not r:
        return {}
    try:
        data = r.json()
    except Exception:
        return {}

    props = {}

    # Growth habits (list → comma string)
    habits = data.get("GrowthHabits") or []
    if habits:
        props["growth_habits"] = ", ".join(habits)
        props["growth_habit_primary"] = habits[0]

    # Durations
    durations = data.get("Durations") or []
    if durations:
        props["duration"] = ", ".join(durations)

    # Taxonomic group (Dicot, Monocot, Gymnosperm, etc.)
    if data.get("Group"):
        props["plant_group"] = data["Group"]

    # Rank
    if data.get("Rank"):
        props["rank"] = data["Rank"]

    # Profile image filename (store for reference)
    if data.get("ProfileImageFilename"):
        props["usda_image_filename"] = data["ProfileImageFilename"]

    # Taxonomy from Ancestors list
    ancestors = data.get("Ancestors") or []
    for anc in ancestors:
        rank = (anc.get("Rank") or "").lower()
        sym = anc.get("Symbol") or ""
        name = anc.get("CommonName") or ""
        if rank == "kingdom":
            props["kingdom"] = sym
        elif rank == "subkingdom":
            props["subkingdom"] = sym
        elif rank == "division":
            props["division"] = sym
        elif rank == "class":
            props["tax_class"] = sym
        elif rank == "order":
            props["tax_order"] = sym
        elif rank == "family":
            props["family"] = sym
        elif rank == "genus":
            props["genus"] = sym

    # Has fruit / wildlife / pollinator flags
    props["has_wildlife_value"] = str(data.get("HasWildlife", False))
    props["has_pollinator_value"] = str(data.get("HasPollinator", False))
    props["has_wetland_data"] = str(data.get("HasWetlandData", False))

    return props


def fetch_gbif_taxonomy(scientific_name: str) -> dict:
    """Fetch GBIF taxonomy for a scientific name."""
    # Use just genus + species for best match
    name_parts = scientific_name.split()
    query_name = " ".join(name_parts[:2]) if len(name_parts) >= 2 else scientific_name

    r = safe_get(GBIF_API, params={"name": query_name, "limit": 1})
    if not r:
        return {}
    try:
        data = r.json()
        results = data.get("results") or []
        if not results:
            return {}
        first = results[0]
        props = {}
        for field in ["kingdom", "phylum", "class", "order", "family", "genus", "species"]:
            if first.get(field):
                key = f"gbif_{field}" if field in ("class", "order") else field
                props[key] = first[field]
        if first.get("vernacularName"):
            props["vernacular_name"] = first["vernacularName"]
        return props
    except Exception:
        return {}


def fetch_wikimedia_images(scientific_name: str, max_images: int = 3) -> list:
    """
    Search Wikimedia Commons for images of a plant by scientific name.
    Returns list of (image_url, title) tuples.
    """
    # Search Commons for the scientific name
    search_params = {
        "action": "query",
        "list": "search",
        "srsearch": f"{scientific_name} plant",
        "srnamespace": "6",  # File namespace
        "srlimit": max_images * 2,
        "format": "json",
    }
    r = safe_get(COMMONS_API, params=search_params)
    if not r:
        return []

    try:
        data = r.json()
        hits = data.get("query", {}).get("search", [])
        titles = [h["title"] for h in hits if h.get("title", "").lower().endswith(
            (".jpg", ".jpeg", ".png", ".webp")
        )][:max_images]

        if not titles:
            return []

        # Get image URLs for those titles
        info_params = {
            "action": "query",
            "titles": "|".join(titles),
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "format": "json",
        }
        r2 = safe_get(COMMONS_API, params=info_params)
        if not r2:
            return []

        pages = r2.json().get("query", {}).get("pages", {})
        results = []
        for page in pages.values():
            info_list = page.get("imageinfo", [])
            if info_list:
                url = info_list[0].get("url")
                mime = info_list[0].get("mime", "")
                if url and "image" in mime:
                    results.append((url, page.get("title", "")))
        return results[:max_images]
    except Exception as e:
        print(f"    Wikimedia error: {e}")
        return []


def download_image(image_url: str, symbol: str, index: int) -> str:
    """Download image to local IMAGE_DIR. Returns local path or empty string."""
    os.makedirs(IMAGE_DIR, exist_ok=True)
    ext = image_url.split(".")[-1].split("?")[0].lower()
    if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
        ext = "jpg"
    filename = f"{symbol}_{index}.{ext}"
    filepath = os.path.join(IMAGE_DIR, filename)

    if os.path.exists(filepath):
        return filepath

    try:
        img_headers = {**BROWSER_HEADERS, "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"}
        r = requests.get(image_url, headers=img_headers, timeout=30, stream=True)
        if r.status_code == 200 and "image" in r.headers.get("Content-Type", ""):
            with open(filepath, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            return filepath
    except Exception as e:
        print(f"    Image download failed: {e}")
    return ""


# ── Main scrape loop ──────────────────────────────────────────────────────────
def scrape_all():
    db = Neo4jDatabase(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
    plants = db.get_all_plants()
    total = len(plants)
    print(f"Starting enrichment for {total} plants...\n")

    for i, plant in enumerate(plants):
        sci_name = plant["scientific_name"]
        symbol = plant.get("usda_symbol") or ""
        print(f"[{i+1}/{total}] {sci_name} (symbol={symbol or 'none'})")

        props = {}

        # 1. USDA PlantProfile (only if we have a symbol)
        if symbol:
            usda_props = fetch_usda_profile(symbol)
            props.update(usda_props)
            if usda_props:
                print(f"  USDA: growth_habits={usda_props.get('growth_habits')}, "
                      f"group={usda_props.get('plant_group')}, "
                      f"family={usda_props.get('family')}")
            time.sleep(REQUEST_DELAY)

        # 2. GBIF taxonomy
        gbif_props = fetch_gbif_taxonomy(sci_name)
        props.update(gbif_props)
        if gbif_props:
            print(f"  GBIF: phylum={gbif_props.get('phylum')}, "
                  f"class={gbif_props.get('gbif_class')}, "
                  f"family={gbif_props.get('family')}")
        time.sleep(REQUEST_DELAY)

        # 3. Store enriched properties
        if props:
            db.update_plant(sci_name, props)

        # 4. Wikimedia images
        images = fetch_wikimedia_images(sci_name, max_images=3)
        if images:
            print(f"  Images: found {len(images)}")
            safe_sym = re.sub(r"[^a-zA-Z0-9]", "_", sci_name)[:30]
            for j, (img_url, title) in enumerate(images):
                local_path = download_image(img_url, safe_sym, j)
                db.store_image(sci_name, img_url, local_path, "wikimedia")
                time.sleep(0.3)
        else:
            print(f"  Images: none found")

        time.sleep(REQUEST_DELAY)

    db.close()
    print(f"\nEnrichment complete for {total} plants.")


if __name__ == "__main__":
    scrape_all()
