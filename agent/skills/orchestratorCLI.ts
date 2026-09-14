import { orchestrate } from "./orchestrator";

async function main() {
  const message = process.argv[2];
  const userId = process.argv[3] || "5106314471";

  if (!message) {
    console.log("No message provided.");
    process.exit(0);
  }

  const response = await orchestrate(message, userId);
  console.log(response);
  process.exit(0);
}

main();