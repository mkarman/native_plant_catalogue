from neo4j import GraphDatabase
import csv
import time

NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "plantcatalogue"


class Neo4jDatabase:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def create_plant_node(self, scientific_name, common_name, native_status, county, usda_symbol):
        with self.driver.session() as session:
            session.execute_write(
                self._create_and_return_plant,
                scientific_name, common_name, native_status, county, usda_symbol
            )

    @staticmethod
    def _create_and_return_plant(tx, scientific_name, common_name, native_status, county, usda_symbol):
        query = (
            "MERGE (p:Plant {scientific_name: $scientific_name}) "
            "SET p.common_name = $common_name, "
            "    p.native_status = $native_status, "
            "    p.county = $county, "
            "    p.usda_symbol = $usda_symbol "
            "RETURN p"
        )
        result = tx.run(
            query,
            scientific_name=scientific_name,
            common_name=common_name,
            native_status=native_status,
            county=county,
            usda_symbol=usda_symbol
        )
        return result.single()

    def link_usda_symbol(self, scientific_name, accepted_symbol, synonym_symbol):
        with self.driver.session() as session:
            session.execute_write(
                self._merge_usda_symbol,
                scientific_name, accepted_symbol, synonym_symbol
            )

    @staticmethod
    def _merge_usda_symbol(tx, scientific_name, accepted_symbol, synonym_symbol):
        # Use first two words of scientific name for fuzzy matching
        prefix = " ".join(scientific_name.split()[:2])
        query = (
            "MATCH (p:Plant) "
            "WHERE p.scientific_name STARTS WITH $prefix "
            "SET p.usda_symbol = $accepted_symbol, "
            "    p.synonym_symbol = $synonym_symbol "
            "RETURN p"
        )
        tx.run(
            query,
            prefix=prefix,
            accepted_symbol=accepted_symbol,
            synonym_symbol=synonym_symbol
        )


def wait_for_neo4j(db, retries=10, delay=5):
    for i in range(retries):
        try:
            with db.driver.session() as session:
                session.run("RETURN 1")
            print("Neo4j is ready.")
            return True
        except Exception as e:
            print(f"Waiting for Neo4j... ({i+1}/{retries}): {e}")
            time.sleep(delay)
    return False


def populate_database():
    db = Neo4jDatabase(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)

    if not wait_for_neo4j(db):
        print("Could not connect to Neo4j. Exiting.")
        db.close()
        return

    print("Populating plants from 91b.csv (bryophytes)...")
    with open('91b.csv', mode='r', encoding='utf-8-sig') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            db.create_plant_node(
                scientific_name=row['Scientific Name'].strip(),
                common_name=row['Common Name'].strip(),
                native_status=row['Native Status'].strip(),
                county=row['County'].strip(),
                usda_symbol=None
            )

    print("Populating plants from 91v.csv (vascular plants)...")
    with open('91v.csv', mode='r', encoding='utf-8-sig') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            db.create_plant_node(
                scientific_name=row['Scientific Name'].strip(),
                common_name=row['Common Name'].strip(),
                native_status=row['Native Status'].strip(),
                county=row['County'].strip(),
                usda_symbol=None
            )

    print("Linking USDA symbols from SearchResults.csv...")
    with open('SearchResults.csv', mode='r', encoding='utf-8-sig') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            db.link_usda_symbol(
                scientific_name=row['ScientificName'].strip(),
                accepted_symbol=row['AcceptedSymbol'].strip(),
                synonym_symbol=row['SynonymSymbol'].strip()
            )

    db.close()
    print("Neo4j database populated successfully.")


if __name__ == "__main__":
    populate_database()
