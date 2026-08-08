from sqlalchemy import create_engine
from dotenv import load_dotenv
import os
import numpy as np
import json
import pandas as pd


load_dotenv(dotenv_path="../.env")
engine = create_engine(
    f"mysql+mysqlconnector://{os.getenv('MYSQL_USER')}:{os.getenv('MYSQL_PASSWORD')}@{os.getenv('MYSQL_HOST')}/{os.getenv('MYSQL_DATABASE')}"
)

def calculate_similarity_score(target: dict, candidate: dict, target_emb, candidate_emb) -> float:
    score = 0.0

    # Structured similarity (60% of total)
    price_diff = abs(target["price"] - candidate["price"])
    if price_diff < 50_000: score += 20
    elif price_diff < 150_000: score += 12
    elif price_diff < 300_000: score += 5

    if target["beds"] == candidate["beds"]: score += 15
    if target["city"] == candidate["city"]: score += 15

    sqft_diff = abs((target.get("sqft") or 0) - (candidate.get("sqft") or 0))
    if sqft_diff < 300: score += 10
    elif sqft_diff < 700: score += 5

    # Semantic similarity (40% of total)
    a = np.array(target_emb)
    b = np.array(candidate_emb)
    sem_sim = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
    score += sem_sim * 40

    return round(score, 2)



def load_index(index_file="../analytics/listing_embeddings.json"):
    with open(index_file, "r") as f:
        return json.load(f)

def recommend_similar(target_listing_id: str, index_file="../analytics/listing_embeddings.json", top_k=5):
    index = load_index(index_file)

    target = next((l for l in index if l["listing_id"] == target_listing_id), None)
    if not target:
        print(f"Listing {target_listing_id} not found in index.")
        return []

    scored = []
    for candidate in index:
        if candidate["listing_id"] == target_listing_id:
            continue  # don't recommend the same listing to itself

        score = calculate_similarity_score(
            target, candidate,
            target["embedding"], candidate["embedding"]
        )
        scored.append((candidate, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]

def validate_with_comps(city: str, sqft: int, price: int, months: int = 24):
    query = """
        SELECT
            AVG(ClosePrice / NULLIF(LivingArea, 0)) AS avg_ppsf,
            COUNT(*) AS comp_count
        FROM california_sold
        WHERE City = %s
          AND PropertyType = 'Residential'
          AND LivingArea BETWEEN %s AND %s
          AND CloseDate >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
    """
    sqft_low = sqft * 0.8
    sqft_high = sqft * 1.2

    result = pd.read_sql(query, engine, params=(city, sqft_low, sqft_high, months))
    row = result.iloc[0]

    avg_ppsf = row["avg_ppsf"] or 0
    comp_count = int(row["comp_count"])
    comp_price = avg_ppsf * sqft

    if comp_price == 0:
        delta_pct = None
    else:
        delta_pct = round((price - comp_price) / comp_price * 100, 1)

    return {
        "comp_price": round(comp_price) if comp_price else None,
        "list_price": price,
        "comp_count": comp_count,
        "delta_pct": delta_pct,
    }


#test on 43305 Sand Canyon Big Bear Lake

if __name__ == "__main__":
    results = recommend_similar("1157041617")

    for listing, score in results:
        comp = validate_with_comps(listing["city"], listing["sqft"], listing["price"])
        
        delta_str = f"{comp['delta_pct']:+.1f}%" if comp["delta_pct"] is not None else "N/A"
        comp_price_str = f"${comp['comp_price']:,}" if comp["comp_price"] else "N/A"

        print(f"{score:.2f} | {listing['address']}, {listing['city']} | ${listing['price']:,} | {listing['beds']}bd/{listing['baths']}ba")
        print(f"   Comp price: {comp_price_str} ({comp['comp_count']} comps) | Delta: {delta_str}")