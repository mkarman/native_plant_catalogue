"""
Plant Characteristics Enrichment Script
========================================
Enriches Neo4j Plant nodes with:
  1. Wikipedia summary (description, height, ecology)
  2. GBIF descriptions (habitat, habit notes)
  3. GBIF occurrence phenology (bloom/fruiting months)
  4. GBIF distributions (IUCN threat status, state range)

Run after populate_neo4j.py and enrich_usda.py.
"""

import time
import re
import requests
from neo4j import GraphDatabase

NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "plantcatalogue"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December"
}


def safe_get(url, params=None, retries=2, delay=1):
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                return r
            elif r.status_code == 404:
                return None
        except requests.RequestException as e:
            if attempt < retries - 1:
                time.sleep(delay)
    return None


def fetch_wikipedia_summary(scientific_name: str) -> dict:
    """Fetch Wikipedia summary for a plant by scientific name."""
    # Try scientific name first, then genus+species
    name_parts = scientific_name.split()
    # Strip author names — use only first two words (genus species)
    query_name = "_".join(name_parts[:2]) if len(name_parts) >= 2 else name_parts[0]

    r = safe_get(f"https://en.wikipedia.org/api/rest_v1/page/summary/{query_name}")
    if r is None:
        return {}

    data = r.json()
    if data.get("type") == "disambiguation":
        return {}

    props = {}
    extract = data.get("extract", "")
    if extract and len(extract) > 50:
        props["wiki_summary"] = extract[:1000]  # cap at 1000 chars

    # Try to extract height from summary
    height_match = re.search(r'(\d+[\-–]\d+|\d+)\s*m\s*(?:tall|high|in height)', extract, re.IGNORECASE)
    if height_match:
        props["height_m"] = height_match.group(0)

    return props


def fetch_gbif_descriptions(gbif_key: int) -> dict:
    """Fetch GBIF descriptions for habitat, habit, and notes."""
    r = safe_get(f"https://api.gbif.org/v1/species/{gbif_key}/descriptions")
    if r is None:
        return {}

    data = r.json()
    results = data.get("results") or []

    props = {}
    habitat_notes = []
    habit_notes = []

    for desc in results:
        desc_type = (desc.get("type") or "").lower()
        text = (desc.get("description") or "").strip()
        if not text or len(text) < 5:
            continue

        if desc_type in ("habitat", "ecology", "distribution"):
            habitat_notes.append(text[:300])
        elif desc_type in ("habit", "growth form", "life form"):
            habit_notes.append(text[:100])

    if habitat_notes:
        props["habitat_notes"] = " | ".join(habitat_notes[:2])
    if habit_notes:
        props["gbif_habit"] = habit_notes[0]

    return props


def fetch_gbif_phenology(gbif_key: int) -> dict:
    """Fetch GBIF occurrence phenology (month distribution of observations)."""
    r = safe_get(
        "https://api.gbif.org/v1/occurrence/search",
        params={"taxonKey": gbif_key, "country": "US", "limit": 0, "facet": "month", "facetLimit": 12}
    )
    if r is None:
        return {}

    data = r.json()
    facets = data.get("facets") or []
    month_counts = {}

    for facet in facets:
        if facet.get("field") == "MONTH":
            for count in facet.get("counts") or []:
                try:
                    month_num = int(count["name"])
                    month_counts[month_num] = count["count"]
                except (KeyError, ValueError):
                    pass

    if not month_counts:
        return {}

    # Find peak months (top 3 by observation count)
    sorted_months = sorted(month_counts.items(), key=lambda x: -x[1])
    peak_months = [MONTH_NAMES[m] for m, _ in sorted_months[:3] if m in MONTH_NAMES]

    # Determine bloom season (months with above-average observations)
    if month_counts:
        avg = sum(month_counts.values()) / len(month_counts)
        active_months = sorted([m for m, c in month_counts.items() if c > avg * 0.5])
        if active_months:
            season_str = ", ".join([MONTH_NAMES[m] for m in active_months if m in MONTH_NAMES])
        else:
            season_str = ""
    else:
        season_str = ""

    props = {}
    if peak_months:
        props["peak_observation_months"] = ", ".join(peak_months)
    if season_str:
        props["active_season"] = season_str

    return props


def fetch_gbif_distributions(gbif_key: int) -> dict:
    """Fetch GBIF distributions for IUCN status and state range."""
    r = safe_get(f"https://api.gbif.org/v1/species/{gbif_key}/distributions")
    if r is None:
        return {}

    data = r.json()
    results = data.get("results") or []

    props = {}
    states = []

    for dist in results:
        # IUCN threat status
        threat = dist.get("threatStatus")
        if threat and "iucn_threat_status" not in props:
            props["iucn_threat_status"] = threat

        # State distribution (TDWG location IDs like TDWG:VRG = Virginia)
        location_id = dist.get("locationId") or ""
        locality = dist.get("locality") or ""
        if location_id.startswith("TDWG:") and locality:
            states.append(locality)

    if states:
        props["us_states"] = ", ".join(sorted(set(states))[:20])  # cap at 20 states

    return props


def get_gbif_key_for_plant(session, scientific_name: str) -> int | None:
    """Get GBIF species key from Neo4j if already stored, else look up."""
    result = session.run(
        "MATCH (p:Plant {scientific_name: $name}) RETURN p.gbif_key AS key",
        name=scientific_name
    ).single()

    if result and result["key"]:
        return int(result["key"])

    # Look up via GBIF API
    name_parts = scientific_name.split()
    query = " ".join(name_parts[:2]) if len(name_parts) >= 2 else scientific_name
    r = safe_get("https://api.gbif.org/v1/species/match", params={"name": query, "limit": 1})
    if r:
        data = r.json()
        key = data.get("usageKey") or data.get("speciesKey")
        if key:
            return int(key)
    return None


def update_plant(session, scientific_name: str, props: dict):
    if not props:
        return
    set_parts = []
    params = {"sci_name": scientific_name}
    for k, v in props.items():
        safe_k = re.sub(r"[^a-zA-Z0-9_]", "_", k)[:50]
        param_k = f"p_{safe_k}"
        set_parts.append(f"p.{safe_k} = ${param_k}")
        params[param_k] = v
    query = (
        f"MATCH (p:Plant {{scientific_name: $sci_name}}) "
        f"SET {', '.join(set_parts)}"
    )
    session.run(query, **params)


def main():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    # Get all plants that haven't been enriched with characteristics yet
    with driver.session() as s:
        result = s.run(
            "MATCH (p:Plant) WHERE p.wiki_summary IS NULL "
            "RETURN p.scientific_name AS sci, p.usda_symbol AS sym "
            "ORDER BY p.scientific_name"
        )
        plants = [{"sci": r["sci"], "sym": r["sym"]} for r in result]

    total = len(plants)
    print(f"Found {total} plants needing characteristics enrichment")

    for i, plant in enumerate(plants):
        sci = plant["sci"]
        print(f"[{i+1}/{total}] {sci}")

        all_props = {}

        # 1. Wikipedia summary
        wiki_props = fetch_wikipedia_summary(sci)
        if wiki_props:
            all_props.update(wiki_props)
            print(f"  Wikipedia: {len(wiki_props)} fields")
        time.sleep(0.3)

        # 2. GBIF key + descriptions + phenology + distributions
        with driver.session() as s:
            gbif_key = get_gbif_key_for_plant(s, sci)

        if gbif_key:
            all_props["gbif_key"] = str(gbif_key)

            desc_props = fetch_gbif_descriptions(gbif_key)
            if desc_props:
                all_props.update(desc_props)
                print(f"  GBIF descriptions: {list(desc_props.keys())}")
            time.sleep(0.3)

            pheno_props = fetch_gbif_phenology(gbif_key)
            if pheno_props:
                all_props.update(pheno_props)
                print(f"  GBIF phenology: peak={pheno_props.get('peak_observation_months')}")
            time.sleep(0.3)

            dist_props = fetch_gbif_distributions(gbif_key)
            if dist_props:
                all_props.update(dist_props)
                print(f"  GBIF distributions: iucn={dist_props.get('iucn_threat_status')}, states={len((dist_props.get('us_states') or '').split(','))}")
            time.sleep(0.3)

        # Store all props
        if all_props:
            with driver.session() as s:
                update_plant(s, sci, all_props)

        time.sleep(0.2)

    driver.close()
    print(f"\nCharacteristics enrichment complete for {total} plants.")


if __name__ == "__main__":
    main()
