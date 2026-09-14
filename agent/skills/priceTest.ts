import { parsePropertyQuery } from "./propertyQueryParser";

async function main() {
  const result = await parsePropertyQuery("find homes in Irvine under 1.2 million with 3 bedrooms single family");
  console.log(result);
}

main();