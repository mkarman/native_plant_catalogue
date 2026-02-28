"""
Fauquier County Native Plant Catalogue - FastAPI Backend
"""

import os
from typing import Optional
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
    """
    Returns live scraping progress by querying Neo4j for enrichment counts.
    """
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
        # Sample of recently enriched plants
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

    return {
        "total_plants": total,
        "usda_enriched": enriched,
        "usda_percent": pct_usda,
        "gbif_enriched": with_gbif,
        "gbif_percent": pct_gbif,
        "plants_with_images": with_images,
        "images_percent": pct_images,
        "total_images_downloaded": total_images,
        "complete": enriched >= total,
        "recent_plants": recent_plants,
    }


@app.get("/api/categories")
def get_categories():
    """Return all plant categories with plant counts and an exemplar image URL."""
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            "MATCH (p:Plant) "
            "RETURN p.growth_habit_primary AS habit, count(p) AS count"
        )
        habit_counts = {r["habit"]: r["count"] for r in result if r["habit"]}

    category_counts: dict[str, int] = {}
    for habit, count in habit_counts.items():
        cat = growth_habit_to_category(habit)
        category_counts[cat] = category_counts.get(cat, 0) + count

    categories = []
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        exemplar_image = None
        exemplar_symbol = CATEGORY_EXEMPLARS.get(cat)
        if exemplar_symbol:
            with driver.session() as session:
                r = session.run(
                    "MATCH (p:Plant {usda_symbol: $sym})-[:HAS_IMAGE]->(i:Image) "
                    "RETURN i.url AS url LIMIT 1",
                    sym=exemplar_symbol
                )
                row = r.single()
                if row:
                    exemplar_image = row["url"]

        categories.append({
            "name": cat,
            "count": count,
            "exemplar_image": exemplar_image,
            "slug": cat.lower().replace(" ", "-").replace("&", "and"),
        })

    driver.close()
    return {"categories": categories}


@app.get("/api/plants")
def get_plants(
    category: Optional[str] = Query(None),
    native_only: bool = Query(True),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Return plants, optionally filtered by category, native status, or search term."""
    driver = get_driver()

    conditions = []
    params: dict = {"skip": skip, "limit": limit}

    if native_only:
        conditions.append("p.native_status = 'N'")

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
    """Return full details for a single plant including all images."""
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
