import { parsePropertyQuery } from "./propertyQueryParser";
import { getNextQuestion, UserSession } from "./sessionManager";
import { searchActiveListings } from "./mlsDataBase";
import { getSessionFromDB, saveSessionToDB, clearSessionInDB } from "./sessionDB";

async function main() {
  const message = process.argv[2];
  const userId = process.argv[3] || "default-user";

  if (!message) {
    console.log("No message provided.");
    process.exit(0);
  }

  if (/^(restart|start over|reset)$/i.test(message.trim())) {
    await clearSessionInDB(userId);
    console.log("Session cleared! I'm ready to try again. What are you looking for?");
    process.exit(0);
  }

  let session: UserSession = await getSessionFromDB(userId);

  const filters = await parsePropertyQuery(message);
  if (filters.city) session.city = filters.city;
  if (filters.maxPrice) session.maxPrice = filters.maxPrice;
  if (filters.beds) session.beds = filters.beds;
  if (filters.type) session.type = filters.type;

  const nextQuestion = getNextQuestion(session);

  if (nextQuestion) {
    await saveSessionToDB(userId, session);
    console.log(nextQuestion);
    process.exit(0);
  }

  const results = await searchActiveListings({
    city: session.city,
    maxPrice: session.maxPrice,
    beds: session.beds,
    type: session.type,
  });

  if (results.length === 0) {
    console.log("No listings found matching your criteria. Want to try different filters?");
  } else {
    const lines = results.slice(0, 5).map((r: any) =>
      `${r.L_Address}, ${r.L_City} — $${Number(r.price).toLocaleString()} | ${r.beds}bd/${r.baths}ba | ${r.sqft} sqft`
    );
    console.log(`Found ${results.length} listings:\n\n${lines.join("\n")}`);
  }

  await clearSessionInDB(userId);
  process.exit(0);
}

main();