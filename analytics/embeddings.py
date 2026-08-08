from google import genai
from dotenv import load_dotenv
import os
import numpy as np
import pandas as pd
from sqlalchemy import create_engine
import json
import time

#loads gemini api key from .env file
load_dotenv(dotenv_path="../.env")
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_embedding(text: str, model="gemini-embedding-001"):
    text = text.replace("\n", " ").strip()[:8000]
    result = client.models.embed_content(model=model, contents=text)
    return result.embeddings[0].values


def build_listing_embedding(row: dict) -> list[float]:
    pool_text = "Has a private pool." if row.get("PoolPrivateYN") in ("1", "True", True) else ""
    view_text = f"Features a view: {row.get('View')}." if row.get("ViewYN") in ("1", "True", True) and row.get("View") else ""
    remarks = row.get("L_Remarks") or ""

    text = f"""
    {row.get('type', '')} in {row.get('L_City', '')}, CA.
    {row.get('beds', '')} beds, {row.get('baths', '')} baths.
    {row.get('sqft', '')} sq ft. Built {row.get('YearBuilt', '')}.
    Price: ${row.get('price', 0):,}.
    {pool_text} {view_text}
    {remarks}
    """.strip()[:8000]
    return get_embedding(text)


def cosine_similarity(vec_a, vec_b) -> float:
    a = np.array(vec_a)
    b = np.array(vec_b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))




engine = create_engine(
    f"mysql+mysqlconnector://{os.getenv('MYSQL_USER')}:{os.getenv('MYSQL_PASSWORD')}@{os.getenv('MYSQL_HOST')}/{os.getenv('MYSQL_DATABASE')}"
)

def fetch_listings_for_embedding(limit=100):
    query = """
        SELECT
            L_ListingID, L_Address, L_City, L_Type_ AS type,
            L_Keyword2 AS beds, LM_Dec_3 AS baths, LM_Int2_3 AS sqft,
            YearBuilt, L_SystemPrice AS price,
            PoolPrivateYN, ViewYN, View, L_Remarks
        FROM rets_property
        WHERE L_Status = 'Active'
        ORDER BY RAND()
        LIMIT %s
    """
    return pd.read_sql(query, engine, params=(limit,))

def build_embeddings_index(limit=100, output_file="listing_embeddings.json"):
    df = fetch_listings_for_embedding(limit)
    index = []

    for i, row in df.iterrows():
        listing_dict = row.to_dict()
        print(f"Embedding {i+1}/{len(df)}: {listing_dict['L_Address']}, {listing_dict['L_City']}")

        embedding = build_listing_embedding(listing_dict)
        index.append({
            "listing_id": listing_dict["L_ListingID"],
            "address": listing_dict["L_Address"],
            "city": listing_dict["L_City"],
            "price": int(listing_dict["price"]) if listing_dict["price"] else None,
            "beds": listing_dict["beds"],
            "baths": float(listing_dict["baths"]) if listing_dict["baths"] else None,
            "sqft": listing_dict["sqft"],
            "embedding": embedding,
        })

        time.sleep(0.5)

    with open(output_file, "w") as f:
        json.dump(index, f)

    print(f"\nSaved {len(index)} embeddings to {output_file}")

def find_similar_listings(query: str, index_file="listing_embeddings.json", top_k=5):
    with open(index_file, "r") as f:
        index = json.load(f)

    query_embedding = get_embedding(query)

    scored = []
    for listing in index:
        score = cosine_similarity(query_embedding, listing["embedding"])
        scored.append((listing, score))

    scored.sort(key=lambda x: x[1], reverse=True)

    return scored[:top_k]


if __name__ == "__main__":
    build_embeddings_index(limit=100)