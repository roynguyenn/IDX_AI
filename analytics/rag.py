from embeddings import get_embedding, cosine_similarity, client
from dotenv import load_dotenv
import os
import json
import sys
sys.path.append(".")
from marketStats import get_city_market_summary

load_dotenv(dotenv_path = "../.env")


# Chunk w/overlap so that the meaning of the chunks arent awkwardly cut from any sequence
def chunk_text(text: str, chunk_size=600, overlap=100) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

#load documents
def load_documents() -> list[dict]:
    docs = []
    
    with open("knowledge/glossary.md", "r", encoding="utf-8") as f:
        docs.append({"title": "Real Estate Data Analyst Primer", "content": f.read()})
    
    with open("knowledge/schema_reference.md", "r", encoding="utf-8") as f:
        docs.append({"title": "MLS Field Reference", "content": f.read()})

    docs.append(generate_market_summary_doc())

    return docs


#index those documents
def index_documents(docs: list[dict]) -> list[dict]:
    indexed = []
    for doc in docs:
        for chunk in chunk_text(doc["content"]):
            indexed.append({
                "source": doc["title"],
                "chunk": chunk,
                "embedding": get_embedding(chunk),
            })
    return indexed



#Compare the embedded documents to the query to grab the top k 

def retrieve(query: str, index: list[dict], top_k=4) -> list[dict]:
    query_emb = get_embedding(query)
    
    scored = []
    for doc in index:
        score = cosine_similarity(query_emb, doc["embedding"])
        scored.append((doc, score))
    
    scored.sort(key=lambda x: x[1], reverse=True)
    return [doc for doc, _ in scored[:top_k]]



#asks the agent to answer the question
def rag_answer(query: str, index: list[dict]) -> str:
    chunks = retrieve(query, index)
    context = "\n\n".join(f"[{c['source']}]\n{c['chunk']}" for c in chunks)
    
    prompt = f"Answer the question using only the context below. If the context doesn't contain the answer, say so.\n\nContext:\n{context}\n\nQuestion: {query}"
    
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite",
        contents=prompt
    )
    return response.text




def generate_market_summary_doc() -> dict:
    df = get_city_market_summary(limit=25)
    
    lines = ["California Market Summary — Last 24 Months (by city)\n"]
    for _, row in df.iterrows():
        lines.append(
            f"{row['City']}: {row['sold_count']} homes sold, "
            f"average close price ${row['avg_close_price']:,.0f}, "
            f"average ${row['avg_price_per_sqft']:,.0f} per square foot, "
            f"average {row['avg_dom']} days on market, "
            f"list-to-close ratio {row['list_to_close_pct']}%."
        )
    
    content = "\n".join(lines)
    return {"title": "Week 5 Market Summary", "content": content}


if __name__ == "__main__":
    docs = load_documents()
    index = index_documents(docs)
    
    with open("rag_index.json", "w") as f:
        json.dump(index, f)
    
    print(f"Indexed {len(index)} chunks from {len(docs)} documents\n")
    
    q = "What's the average price per square foot in Irvine?"
    print(f"Q: {q}")
    print(f"A: {rag_answer(q, index)}")