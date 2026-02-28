"""
Direct USDA enrichment script - fixes the background scraper issue
by directly calling USDA API and writing to Neo4j for all plants with symbols.
"""
import time
import re
import requests
from neo4j import GraphDatabase

NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "plantcatalogue"
USDA_API = "https://plantsservices.sc.egov.usda.gov/api/PlantProfile"
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}


def fetch_usda_profile(symbol: str) -> dict:
    try:
        r = requests.get(USDA_API, params={"symbol": symbol}, headers=HEADERS, timeout=20)
        if r.status_code != 200:
            return {}
        data = r.json()
    except Exception as e:
        print(f"  USDA error for {symbol}: {e}")
        return {}

    props = {}
    habits = data.get("GrowthHabits") or []
    if habits:
        props["growth_habits"] = ", ".join(habits)
        props["growth_habit_primary"] = habits[0]
    durations = data.get("Durations") or []
    if durations:
        props["duration"] = ", ".join(durations)
    if data.get("Group"):
        props["plant_group"] = data["Group"]
    if data.get("Rank"):
        props["rank"] = data["Rank"]
    if data.get("ProfileImageFilename"):
        props["usda_image_filename"] = data["ProfileImageFilename"]

    ancestors = data.get("Ancestors") or []
    for anc in ancestors:
        rank = (anc.get("Rank") or "").lower()
        sym = anc.get("Symbol") or ""
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

    props["has_wildlife_value"] = str(data.get("HasWildlife", False))
    props["has_pollinator_value"] = str(data.get("HasPollinator", False))
    props["has_wetland_data"] = str(data.get("HasWetlandData", False))
    return props


def update_plant(session, scientific_name: str, props: dict):
    if not props:
        return
    # Build SET clause with explicit param names to avoid conflicts
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

    # Get all plants with USDA symbols that haven't been enriched yet
    with driver.session() as s:
        result = s.run(
            "MATCH (p:Plant) WHERE p.usda_symbol IS NOT NULL AND p.usda_symbol <> '' "
            "AND p.growth_habit_primary IS NULL "
            "RETURN p.scientific_name AS sci, p.usda_symbol AS sym "
            "ORDER BY p.scientific_name"
        )
        plants = [{"sci": r["sci"], "sym": r["sym"]} for r in result]

    total = len(plants)
    print(f"Found {total} plants needing USDA enrichment")

    for i, plant in enumerate(plants):
        sci = plant["sci"]
        sym = plant["sym"]
        props = fetch_usda_profile(sym)
        if props:
            with driver.session() as s:
                update_plant(s, sci, props)
            print(f"[{i+1}/{total}] {sci} ({sym}) -> habit={props.get('growth_habit_primary')}, family={props.get('family')}")
        else:
            print(f"[{i+1}/{total}] {sci} ({sym}) -> no data")
        time.sleep(0.3)

    driver.close()
    print(f"\nUSDA enrichment complete for {total} plants.")


if __name__ == "__main__":
    main()
