
type Intent = "search" | "market" | "recommend" | "knowledge" | "mixed" | "unknown";

export function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();

  const searchWords = ["find", "show me", "looking for", "search", "homes in", "condo", "bed", "bath"];
  const marketWords = ["market", "trend", "rising", "falling", "average price", "days on market", "price per"];
  const recommendWords = ["similar", "recommend", "like this", "comparable", "comp"];
  const knowledgeWords = ["what does", "what is", "mean", "define", "explain"];

  const hasSearch = searchWords.some(w => q.includes(w));
  const hasMarket = marketWords.some(w => q.includes(w));
  const hasRecommend = recommendWords.some(w => q.includes(w));
  const hasKnowledge = knowledgeWords.some(w => q.includes(w));

  if (hasKnowledge) return "knowledge";
  if (hasRecommend) return "recommend";
  if (hasSearch && hasMarket) return "mixed";
  if (hasSearch) return "search";
  if (hasMarket) return "market";

  return "unknown";
}

function test() {
  const queries = [
    "Find me affordable homes in Pasadena and tell me whether prices are rising",
    "Find 3 bedroom condos in Irvine under $1M",
    "What's the average price per sqft in San Diego",
    "What does DOM mean?",
    "Show me similar listings to this one",
  ];

  for (const q of queries) {
    console.log(`"${q}" → ${classifyIntent(q)}`);
  }
}


import { execSync } from "child_process";
import { parsePropertyQuery } from "./propertyQueryParser";
import { getSession, updateSession, getNextQuestion } from "./sessionManager";
import { searchActiveListings } from "./mlsDataBase";

async function propertySearchAgent(query: string, userId: string): Promise<string> {
  const session = getSession(userId);
  const filters = await parsePropertyQuery(query);

  const updates: any = {};
  if (filters.city) updates.city = filters.city;
  if (filters.maxPrice) updates.maxPrice = filters.maxPrice;
  if (filters.beds) updates.beds = filters.beds;
  if (filters.type) updates.type = filters.type;
  updateSession(userId, updates);

  const updatedSession = getSession(userId);
  const nextQuestion = getNextQuestion(updatedSession);
  if (nextQuestion) return nextQuestion;

  const results = await searchActiveListings({
    city: updatedSession.city,
    maxPrice: updatedSession.maxPrice,
    beds: updatedSession.beds,
    type: updatedSession.type,
  });

  if (results.length === 0) return "No listings found matching your criteria.";
  
  updateSession(userId, { lastListingId: (results[0] as any).L_ListingID });

  return results.slice(0, 5).map((r: any) =>
    `${r.L_Address}, ${r.L_City} — $${Number(r.price).toLocaleString()} | ${r.beds}bd/${r.baths}ba`
    ).join("\n");
 
}

function marketStatsAgent(query: string): string {
  const cityMatch = query.match(/in ([A-Za-z\s]+?)(?:\s+and|\s+but|\?|$)/i);
  const city = cityMatch?.[1]?.trim() || "Irvine";

  const output = execSync(
    `cd ../../analytics && python -c "from marketStats import get_city_market_summary; import pandas as pd; df = get_city_market_summary(); row = df[df['City'] == '${city}']; print(row.to_string(index=False) if not row.empty else 'No data for ${city}')"`,
    { encoding: "utf-8" }
  );
  return output.trim();
}

function ragAgent(query: string): string {
  const output = execSync(
    `cd ../../analytics && python -c "from rag import rag_answer, load_documents, index_documents; import json; index = json.load(open('rag_index.json')); print(rag_answer('${query.replace(/'/g, "\\'")}', index))"`,
    { encoding: "utf-8" }
  );
  return output.trim();
}

//testing

async function testAgents() {
  console.log("--- marketStatsAgent ---");
  console.log(marketStatsAgent("What's the average price per sqft in Oakland?"));

  console.log("\n--- ragAgent ---");
  console.log(ragAgent("What does DOM mean?"));

  console.log("\n--- propertySearchAgent ---");
  console.log(await propertySearchAgent("Find homes in Irvine under 1.2M single family 3 beds", "test-user"));
}


function recommendationAgent(userId: string): string {
  const session = getSession(userId);
  if (!session.lastListingId) {
    return "I don't have a listing to base recommendations on yet. Search for a property first.";
  }

  const output = execSync(
    `cd ../../analytics && python recommend_cli.py "${session.lastListingId}"`,
    { encoding: "utf-8" }
  );

  return output.trim();
}

export async function orchestrate(query: string, userId: string): Promise<string> {
  const intent = classifyIntent(query);

  switch (intent) {
    case "search":
      return await propertySearchAgent(query, userId);

    case "market":
      return marketStatsAgent(query);

    case "recommend":
      return recommendationAgent(userId);

    case "knowledge":
      return ragAgent(query);

    case "mixed": {
      const [listings, stats] = await Promise.all([
        propertySearchAgent(query, userId),
        Promise.resolve(marketStatsAgent(query)),
      ]);
      return `${listings}\n\n---\n\nMarket context:\n${stats}`;
    }

    default:
      return "I'm not sure how to help with that. Try asking about properties, market trends, recommendations, or definitions.";
  }
}




async function testOrchestrator() {
  const userId = "orchestrator-test-user";

  console.log("--- Test 1: search ---");
  console.log(await orchestrate("Find homes in Irvine under 1.2M single family 3 beds", userId));

  console.log("\n--- Test 2: market ---");
  console.log(await orchestrate("What's the average price per sqft in Irvine?", userId));

  console.log("\n--- Test 3: knowledge ---");
  console.log(await orchestrate("What does DOM mean?", userId));

  console.log("\n--- Test 4: recommend (after a search) ---");
  console.log(await orchestrate("Show me similar listings", userId));

  console.log("\n--- Test 5: mixed ---");
  console.log(await orchestrate("Find affordable homes in Irvine and tell me if prices are rising", userId));

  console.log("\n--- Test 6: unknown ---");
  console.log(await orchestrate("What's your favorite color?", userId));
}


async function testOrchestrator2() {
  const userId = "orchestrator-test-user";
  console.log("--- Test 5: mixed ---");
  console.log(await orchestrate("Find affordable homes in Irvine and tell me if prices are rising", userId));
}

if (require.main === module) {
  testOrchestrator2();
}