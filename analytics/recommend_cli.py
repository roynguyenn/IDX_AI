import sys
from recommendations import recommend_similar

listing_id = sys.argv[1]
results = recommend_similar(listing_id)

if not results:
    print("No recommendations found.")
else:
    for listing, score in results:
        print(f"{score:.2f} | {listing['address']}, {listing['city']} | ${listing['price']:,}")