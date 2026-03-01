"""
Fauquier County Native Plant Catalogue - FastAPI Backend
"""

import os
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from neo4j import GraphDatabase

app = FastAPI(
    title="Fauquier Native Plant Catalogue API",
    description="API for the Fauquier County, Virginia native plant visual catalogue",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve local plant images
IMAGES_DIR = os.environ.get("IMAGES_DIR", "/app/images")
if os.path.isdir(IMAGES_DIR):
    app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

# ── Neo4j connection ──────────────────────────────────────────────────────────
NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "plantcatalogue")


def get_driver():
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


# ── Category mapping ──────────────────────────────────────────────────────────
CATEGORY_MAP = {
    "Tree": "Trees",
    "Shrub": "Shrubs",
    "Subshrub": "Shrubs",
    "Vine": "Vines",
    "Forb/herb": "Wildflowers & Herbs",
    "Graminoid": "Grasses & Sedges",
    "Fern": "Ferns",
    "Nonvascular": "Mosses & Liverworts",
    "Lichenous": "Lichens",
}

# Preferred exemplar USDA symbols — used as hints but not required to have images
CATEGORY_EXEMPLARS = {
    "Trees": "ACRU",
    "Shrubs": "COCO6",
    "Vines": "LOJA",
    "Wildflowers & Herbs": "ECAN4",
    "Grasses & Sedges": "ANGE",
    "Ferns": "OSRE2",
    "Mosses & Liverworts": "ANSP",
    "Lichens": None,
}


def growth_habit_to_category(growth_habit: Optional[str]) -> str:
    if not growth_habit:
        return "Other"
    for key, cat in CATEGORY_MAP.items():
        if key.lower() in growth_habit.lower():
            return cat
    return "Other"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Fauquier Native Plant Catalogue API", "version": "1.0.0"}


@app.get("/api/scrape/progress")
def get_scrape_progress():
    """Returns live scraping progress by querying Neo4j for enrichment counts."""
    driver = get_driver()
    with driver.session() as session:
        total = session.run("MATCH (p:Plant) RETURN count(p) AS n").single()["n"]
        enriched = session.run(
            "MATCH (p:Plant) WHERE p.growth_habit_primary IS NOT NULL RETURN count(p) AS n"
        ).single()["n"]
        with_gbif = session.run(
            "MATCH (p:Plant) WHERE p.phylum IS NOT NULL RETURN count(p) AS n"
        ).single()["n"]
        with_images = session.run(
            "MATCH (p:Plant)-[:HAS_IMAGE]->() RETURN count(DISTINCT p) AS n"
        ).single()["n"]
        total_images = session.run(
            "MATCH (i:Image) RETURN count(i) AS n"
        ).single()["n"]
        with_characteristics = session.run(
            "MATCH (p:Plant) WHERE p.wiki_summary IS NOT NULL RETURN count(p) AS n"
        ).single()["n"]
        recent = session.run(
            "MATCH (p:Plant) WHERE p.growth_habit_primary IS NOT NULL "
            "RETURN p.scientific_name AS name, p.growth_habit_primary AS habit, "
            "       p.family AS family "
            "ORDER BY p.scientific_name DESC LIMIT 5"
        )
        recent_plants = [dict(r) for r in recent]

    driver.close()
    pct_usda = round(enriched / total * 100, 1) if total else 0
    pct_gbif = round(with_gbif / total * 100, 1) if total else 0
    pct_images = round(with_images / total * 100, 1) if total else 0
    pct_chars = round(with_characteristics / total * 100, 1) if total else 0

    return {
        "total_plants": total,
        "usda_enriched": enriched,
        "usda_percent": pct_usda,
        "gbif_enriched": with_gbif,
        "gbif_percent": pct_gbif,
        "plants_with_images": with_images,
        "images_percent": pct_images,
        "total_images_downloaded": total_images,
        "characteristics_enriched": with_characteristics,
        "characteristics_percent": pct_chars,
        "complete": enriched >= total,
        "recent_plants": recent_plants,
    }


@app.get("/api/categories")
def get_categories():
    """
    Return all plant categories with plant counts and an exemplar image URL.
    The exemplar image is dynamically selected: prefers the hardcoded exemplar
    symbol if it has an image, otherwise falls back to any native plant in that
    category that has an image.
    """
    driver = get_driver()

    # Get habit counts
    with driver.session() as session:
        result = session.run(
            "MATCH (p:Plant) "
            "RETURN p.growth_habit_primary AS habit, count(p) AS count"
        )
        habit_counts = {r["habit"]: r["count"] for r in result if r["habit"]}

    # Aggregate into display categories
    category_counts: dict[str, int] = {}
    for habit, count in habit_counts.items():
        cat = growth_habit_to_category(habit)
        category_counts[cat] = category_counts.get(cat, 0) + count

    # For each category, find an exemplar image dynamically
    # Strategy: try preferred symbol first, then any native plant with an image in that category
    categories = []
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        exemplar_image = None
        exemplar_name = None
        slug = cat.lower().replace(" ", "-").replace("&", "and")

        # Get the growth habits that map to this category
        target_habits = [k for k, v in CATEGORY_MAP.items() if v == cat]

        with driver.session() as session:
            # 1. Try preferred exemplar symbol first
            preferred_sym = CATEGORY_EXEMPLARS.get(cat)
            if preferred_sym:
                r = session.run(
                    "MATCH (p:Plant {usda_symbol: $sym})-[:HAS_IMAGE]->(i:Image) "
                    "RETURN i.url AS url, p.common_name AS name LIMIT 1",
                    sym=preferred_sym
                )
                row = r.single()
                if row:
                    exemplar_image = row["url"]
                    exemplar_name = row["name"]

            # 2. Fall back to any native plant in this category with an image
            if not exemplar_image and target_habits:
                habit_list = " OR ".join([f"p.growth_habit_primary = '{h}'" for h in target_habits])
                r2 = session.run(
                    f"MATCH (p:Plant)-[:HAS_IMAGE]->(i:Image) "
                    f"WHERE ({habit_list}) AND p.native_status = 'N' "
                    f"RETURN i.url AS url, p.common_name AS name "
                    f"ORDER BY p.scientific_name LIMIT 1"
                )
                row2 = r2.single()
                if row2:
                    exemplar_image = row2["url"]
                    exemplar_name = row2["name"]

            # 3. Last resort: any plant in this category with an image (including non-native)
            if not exemplar_image and target_habits:
                habit_list = " OR ".join([f"p.growth_habit_primary = '{h}'" for h in target_habits])
                r3 = session.run(
                    f"MATCH (p:Plant)-[:HAS_IMAGE]->(i:Image) "
                    f"WHERE ({habit_list}) "
                    f"RETURN i.url AS url, p.common_name AS name "
                    f"ORDER BY p.scientific_name LIMIT 1"
                )
                row3 = r3.single()
                if row3:
                    exemplar_image = row3["url"]
                    exemplar_name = row3["name"]

        categories.append({
            "name": cat,
            "count": count,
            "exemplar_image": exemplar_image,
            "exemplar_name": exemplar_name,
            "slug": slug,
        })

    driver.close()
    return {"categories": categories}


@app.get("/api/filter-options")
def get_filter_options():
    """Return all distinct values for filterable fields."""
    driver = get_driver()
    with driver.session() as session:
        durations = session.run(
            "MATCH (p:Plant) WHERE p.duration IS NOT NULL "
            "UNWIND split(p.duration, ', ') AS d "
            "RETURN DISTINCT d AS duration ORDER BY d"
        )
        duration_values = [r["duration"] for r in durations if r["duration"]]

    driver.close()
    return {
        "durations": duration_values,
        "native_statuses": [
            {"value": "N", "label": "Native"},
            {"value": "I", "label": "Introduced"},
            {"value": "U", "label": "Status Unknown"},
        ],
        "boolean_filters": [
            {"key": "wildlife", "label": "Wildlife Value"},
            {"key": "pollinator", "label": "Pollinator Plant"},
            {"key": "wetland", "label": "Wetland Species"},
        ]
    }


@app.get("/api/plants")
def get_plants(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    native_status: Optional[str] = Query(None, description="Filter by native status. Comma-separated values (N,I,U). Prefix with ! to exclude."),
    wildlife: Optional[str] = Query(None, description="Filter by wildlife value: 'true', 'false', or omit"),
    pollinator: Optional[str] = Query(None, description="Filter by pollinator value: 'true', 'false', or omit"),
    wetland: Optional[str] = Query(None, description="Filter by wetland status: 'true', 'false', or omit"),
    duration: Optional[str] = Query(None, description="Filter by duration. Comma-separated (Perennial,Annual,Biennial). Prefix with ! to exclude."),
    native_only: Optional[bool] = Query(None),
):
    """Return plants with rich filtering support."""
    driver = get_driver()

    conditions = []
    params: dict = {"skip": skip, "limit": limit}

    if native_only is True:
        conditions.append("p.native_status = 'N'")

    if native_status:
        if native_status.startswith("!"):
            excluded = [v.strip() for v in native_status[1:].split(",") if v.strip()]
            if excluded:
                excl_list = ", ".join([f"'{v}'" for v in excluded])
                conditions.append(f"NOT p.native_status IN [{excl_list}]")
        else:
            included = [v.strip() for v in native_status.split(",") if v.strip()]
            if included:
                incl_list = ", ".join([f"'{v}'" for v in included])
                conditions.append(f"p.native_status IN [{incl_list}]")

    if category and category != "all":
        target_habits = [
            k for k, v in CATEGORY_MAP.items()
            if v.lower().replace(" ", "-").replace("&", "and") == category
        ]
        if target_habits:
            habit_conditions = " OR ".join(
                [f"p.growth_habit_primary = '{h}'" for h in target_habits]
            )
            conditions.append(f"({habit_conditions})")

    if search:
        conditions.append(
            "(toLower(p.scientific_name) CONTAINS toLower($search) OR "
            "toLower(p.common_name) CONTAINS toLower($search))"
        )
        params["search"] = search

    bool_field_map = {
        "wildlife": "has_wildlife_value",
        "pollinator": "has_pollinator_value",
        "wetland": "has_wetland_data",
    }
    for filter_key, db_field in bool_field_map.items():
        filter_val = {"wildlife": wildlife, "pollinator": pollinator, "wetland": wetland}[filter_key]
        if filter_val == "true":
            conditions.append(f"p.{db_field} = 'True'")
        elif filter_val == "false":
            conditions.append(f"(p.{db_field} IS NULL OR p.{db_field} = 'False')")

    if duration:
        if duration.startswith("!"):
            excluded_durations = [v.strip() for v in duration[1:].split(",") if v.strip()]
            for d in excluded_durations:
                conditions.append(f"NOT p.duration CONTAINS '{d}'")
        else:
            included_durations = [v.strip() for v in duration.split(",") if v.strip()]
            if included_durations:
                dur_conditions = " OR ".join([f"p.duration CONTAINS '{d}'" for d in included_durations])
                conditions.append(f"({dur_conditions})")

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    query = (
        f"MATCH (p:Plant) {where_clause} "
        "OPTIONAL MATCH (p)-[:HAS_IMAGE]->(i:Image) "
        "WITH p, collect(i.url)[0] AS thumbnail "
        "RETURN p.scientific_name AS scientific_name, "
        "       p.common_name AS common_name, "
        "       p.native_status AS native_status, "
        "       p.growth_habit_primary AS growth_habit, "
        "       p.family AS family, "
        "       p.phylum AS phylum, "
        "       p.gbif_class AS tax_class, "
        "       p.usda_symbol AS usda_symbol, "
        "       p.duration AS duration, "
        "       p.plant_group AS plant_group, "
        "       p.has_wildlife_value AS has_wildlife_value, "
        "       p.has_pollinator_value AS has_pollinator_value, "
        "       p.has_wetland_data AS has_wetland_data, "
        "       p.active_season AS active_season, "
        "       p.iucn_threat_status AS iucn_threat_status, "
        "       thumbnail "
        "ORDER BY p.scientific_name "
        "SKIP $skip LIMIT $limit"
    )

    with driver.session() as session:
        result = session.run(query, **params)
        plants = [dict(r) for r in result]

    count_query = f"MATCH (p:Plant) {where_clause} RETURN count(p) AS total"
    with driver.session() as session:
        total = session.run(
            count_query,
            **{k: v for k, v in params.items() if k not in ("skip", "limit")}
        ).single()["total"]

    driver.close()
    return {"plants": plants, "total": total, "skip": skip, "limit": limit}


@app.get("/api/plants/{scientific_name:path}")
def get_plant_detail(scientific_name: str):
    """Return full details for a single plant including all images and characteristics."""
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            "MATCH (p:Plant {scientific_name: $name}) "
            "OPTIONAL MATCH (p)-[:HAS_IMAGE]->(i:Image) "
            "RETURN p, collect(i) AS images",
            name=scientific_name
        )
        row = result.single()
        if not row:
            raise HTTPException(status_code=404, detail="Plant not found")
        plant = dict(row["p"])
        images = [dict(img) for img in row["images"]]

    driver.close()
    return {"plant": plant, "images": images}


@app.get("/api/plants/{scientific_name:path}/related")
def get_related_plants(scientific_name: str, limit: int = 6):
    """Return plants related by shared family or growth habit."""
    driver = get_driver()
    with driver.session() as session:
        p_result = session.run(
            "MATCH (p:Plant {scientific_name: $name}) "
            "RETURN p.family AS family, p.growth_habit_primary AS habit",
            name=scientific_name
        ).single()

        if not p_result:
            raise HTTPException(status_code=404, detail="Plant not found")

        family = p_result["family"]
        habit = p_result["habit"]

        related = session.run(
            "MATCH (p:Plant) "
            "WHERE p.scientific_name <> $name "
            "AND (p.family = $family OR p.growth_habit_primary = $habit) "
            "OPTIONAL MATCH (p)-[:HAS_IMAGE]->(i:Image) "
            "WITH p, collect(i.url)[0] AS thumbnail "
            "RETURN p.scientific_name AS scientific_name, "
            "       p.common_name AS common_name, "
            "       p.growth_habit_primary AS growth_habit, "
            "       thumbnail "
            "LIMIT $limit",
            name=scientific_name, family=family, habit=habit, limit=limit
        )
        related_plants = [dict(r) for r in related]

    driver.close()
    return {"related": related_plants}


@app.get("/api/stats")
def get_stats():
    """Return summary statistics for the catalogue."""
    driver = get_driver()
    with driver.session() as session:
        total = session.run("MATCH (p:Plant) RETURN count(p) AS n").single()["n"]
        native = session.run(
            "MATCH (p:Plant {native_status: 'N'}) RETURN count(p) AS n"
        ).single()["n"]
        with_images = session.run(
            "MATCH (p:Plant)-[:HAS_IMAGE]->() RETURN count(DISTINCT p) AS n"
        ).single()["n"]
        families = session.run(
            "MATCH (p:Plant) WHERE p.family IS NOT NULL "
            "RETURN count(DISTINCT p.family) AS n"
        ).single()["n"]

    driver.close()
    return {
        "total_plants": total,
        "native_plants": native,
        "introduced_plants": total - native,
        "plants_with_images": with_images,
        "unique_families": families,
    }
