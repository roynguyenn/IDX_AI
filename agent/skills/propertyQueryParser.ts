interface PropertyFilters {
  city: string | null;
  maxPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  type: string | null;
  pool: string | null;
  hasView: string | null;
}

export async function parsePropertyQuery(query: string): Promise<PropertyFilters> {
    // city
    const cityMatch = query.match(/in ([A-Zaz\s]+?)(?:\s+under|\s+with|\s+at|$)/i);

    // price
    const priceMatch = query.match(/under \$?([\d,.]+)(k|m)?/i);

    //bed
    const bedsMatch = query.match(/(\d+)[\s-]*(bed|beds|bedroom|bedrooms)/i);

    //baths
    const bathsMatch = query.match(/(\d+(?:\.5)?)[\s-]*(bath|baths|bathroom)/i);

    //sqft
    const sqftMatch = query.match(/(\d+)[\s,]*(sqft|sq ft|square feet)/i);

    //pool
    const poolMatch = /pool/i.test(query);

    //view
    const viewMatch = /view/i.test(query);

    const typeMap: Record<string, string> = {
        "condo": "Condominium",
        "townhome": "Townhouse",
        "single family": "SingleFamilyResidence",
        "land": "UnimprovedLand"
    };

    const typeKey = Object.keys(typeMap).find(k => query.toLowerCase().includes(k));

    let maxPrice: number | null = null;
    if (priceMatch) {
        maxPrice = Number(priceMatch[1].replace(/,/g, ""));
        if (priceMatch[2]?.toLowerCase() === "k") maxPrice *= 1000;
        if (priceMatch[2]?.toLowerCase() === "m") maxPrice *= 1_000_000;
    }

    return {
    city: cityMatch?.[1]?.trim() || null,
    maxPrice,
    beds: bedsMatch ? Number(bedsMatch[1]) : null,
    baths: bathsMatch ? Number(bathsMatch[1]) : null,
    sqft: sqftMatch ? Number(sqftMatch[1]) : null,
    type: typeKey ? typeMap[typeKey] : null,
    pool: poolMatch ? "True" : null,
    hasView: viewMatch ? "True" : null,
  };
}

// Test it
async function test() {
  const queries = [
    "Show me 3 bedroom condos in Irvine under $1.5M with a pool",
    "Find single family homes in Pasadena under $800k with a view",
    "2 bed townhome in Newport Beach under $900k",
    "Find a 4 bed 2.5 bath house in San Diego under $1.2M",
    "Show me condos in Santa Monica with at least 1200 sqft",
    "3 bedroom single family home in Riverside under $600k with a pool and a view",
    "Land for sale in Malibu under $2M",
    "2 bed 1 bath condo in Long Beach under $500k",
    "Townhome in Irvine under $1M with a view",
    "Single family home in Pasadena with a pool under $950000"
  ];

  for (const q of queries) {
    console.log("\nQuery:", q);
    console.log("Result:", await parsePropertyQuery(q));
  }
}

test();