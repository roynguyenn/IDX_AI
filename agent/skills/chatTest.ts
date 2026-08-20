import * as readline from "readline";
import { parsePropertyQuery } from "./propertyQueryParser";
import { getSession, updateSession, getNextQuestion } from "./sessionManager";
import { searchActiveListings } from "./mlsDataBase";


//This file uses in memory session management 

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const userId = "test-user";

console.log("Chat with your agent. Type 'exit' to quit.\n");

function ask() {
  rl.question("You: ", async (input) => {
    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    const filters = await parsePropertyQuery(input);

    const updates: Partial<ReturnType<typeof getSession>> = {};
    if (filters.city) updates.city = filters.city;
    if (filters.maxPrice) updates.maxPrice = filters.maxPrice;
    if (filters.beds) updates.beds = filters.beds;
    if (filters.type) updates.type = filters.type;

    updateSession(userId, updates);

    const session = getSession(userId);
    const nextQuestion = getNextQuestion(session);

    if (nextQuestion) {
      console.log(`Agent: ${nextQuestion}\n`);
    } else {
      console.log(`Agent: Got it! Searching...\n`);

      const results = await searchActiveListings({
        city: session.city,
        maxPrice: session.maxPrice,
        beds: session.beds,
        type: session.type,
      });

      console.log(`Found ${results.length} listings:`);
      results.slice(0, 5).forEach((r: any) => {
        console.log(`- ${r.L_Address}, ${r.L_City} | $${r.price?.toLocaleString()} | ${r.beds}bd/${r.baths}ba`);
      });
      console.log();
    }

    ask();
  });
}

ask();