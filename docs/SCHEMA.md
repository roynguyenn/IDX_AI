# Schema Annotation

Both tables live in one MySQL schema (`idx_exchange`). They aren't foreign-keyed to each other — the join is done at query time, either on `rets_property.L_ListingID` / `california_sold.ListingKey`, or on city (+ postal code) for market-level aggregation where no direct listing match exists (an active listing usually isn't in the sold-comps table yet, and vice versa).

Legend: **✅ used** = actually referenced in current code, with where. Everything else exists in the imported dataset but isn't touched yet — fair game to use, not dead weight to remove.

## `rets_property` — active listings (~53K rows)

IDX's own legacy field names, not RESO-standard. This is the one table where the naming is genuinely non-obvious (`L_Keyword2` for bedrooms, `LM_Dec_3` for bathrooms) — that mismatch is exactly why the RAG assistant indexes this table's schema reference as a fourth knowledge source.

| Field | Used? | Notes |
|---|---|---|
| `L_ListingID` | ✅ `mlsDataBase.ts` | Join key to `california_sold.ListingKey` |
| `L_DisplayId` | ✅ `mlsDataBase.ts` | Selected but not currently surfaced in reply text |
| `L_Address` | ✅ everywhere | Primary display field for a listing |
| `L_City` | ✅ `mlsDataBase.ts`, `propertyQueryParser.ts` | Filter + display |
| `L_Zip` | ✅ `mlsDataBase.ts` | Selected, not yet used as a filter |
| `L_Class` | — | Not queried; all current searches implicitly assume Residential |
| `L_Type_` | ✅ `mlsDataBase.ts`, `propertyQueryParser.ts` | "condo"/"single family"/etc. filter |
| `L_Keyword2` (bedrooms) | ✅ `mlsDataBase.ts`, `propertyQueryParser.ts` | Non-obvious name — see RAG schema doc |
| `LM_Dec_3` (bathrooms) | ✅ `mlsDataBase.ts`, `propertyQueryParser.ts` | Supports half-baths (e.g. 2.5) |
| `L_SystemPrice` | ✅ `mlsDataBase.ts`, `propertyQueryParser.ts` | Current list price; min/max filter |
| `LM_Int2_3` (sqft) | ✅ `mlsDataBase.ts`, `propertyQueryParser.ts` | |
| `L_Keyword1` (lot size) | — | Present, unused |
| `LMD_MP_Latitude` / `Longitude` | ✅ `mlsDataBase.ts` | Selected, not yet used for radius search or mapping |
| `L_Status` | ✅ `mlsDataBase.ts` | Hard-filtered to `Active` in every search |
| `L_Remarks` | — | Full-text listing description — the obvious next input for the embeddings pipeline, but `embeddings.py`'s 100-listing sample doesn't currently pull from it live (fixed sample, not query-driven) |
| `L_Photos` | — | JSON photo URL array, unused (no image features yet) |
| `LA1_UserFirstName` / `LastName`, `ListAgentEmail`, `ListAgentDirectPhone` | ✅ (name only) `mlsDataBase.ts` | Agent name selected; email/phone imported but unused |
| `LO1_OrganizationName` | ✅ `mlsDataBase.ts` | Brokerage name, selected not displayed |
| `ListingContractDate` | — | Present, unused |
| `YearBuilt` | ✅ `mlsDataBase.ts` | Selected; also a `propertyQueryParser.ts` filter per memory notes |
| `SubdivisionName` | — | Present, unused |
| `AssociationFee` (HOA) | ✅ `propertyQueryParser.ts` | HOA filter |
| `AssociationAmenities` | — | Present, unused |
| `DaysOnMarket` | ✅ `mlsDataBase.ts` | Selected |
| `PoolPrivateYN` | ✅ `mlsDataBase.ts`, `propertyQueryParser.ts` | Pool filter |
| `FireplaceYN` | ✅ `mlsDataBase.ts`, `propertyQueryParser.ts` | Fireplace filter |
| `ViewYN` / `View` | ✅ `mlsDataBase.ts` (`ViewYN`) | `View` (description text) unused |
| `LotSizeAcres` / `LotSizeSquareFeet` | — | Present, unused |
| `PreviousListPrice` | — | Present, unused — would enable "price reduced" queries |
| `StandardStatus` | — | RESO-standard status; unused in favor of `L_Status` |
| `CountyOrParish` | — | Present, unused |
| `ParcelNumber` | — | Present, unused |
| `Cooling` / `Heating` | — | Present, unused |
| `ArchitecturalStyle` | — | Present, unused |
| `PhotoCount` | ✅ `mlsDataBase.ts` | Selected, not displayed in reply text yet |
| `ModificationTimestamp` | — | Present, unused — would drive incremental sync if this became a live feed |

## `california_sold` — sold transactions/comps (~87K rows)

Mostly RESO/Trestle-standard field names — the one table fully covered by standard documentation, per the RAG knowledge sources.

| Field | Used? | Notes |
|---|---|---|
| `ListingKey` | ✅ `mlsDataBase.ts` | Join key to `rets_property.L_ListingID` |
| `ClosePrice` | ✅ `marketStats.py`, `recommendations.py` | Core value for every market stat |
| `CloseDate` | ✅ `marketStats.py`, `recommendations.py` | Date-windowed in every query (last N months) |
| `OriginalListPrice` | ✅ `mlsDataBase.ts` | Selected, not aggregated yet |
| `ListPrice` | ✅ `marketStats.py` | Used for list-to-close ratio |
| `DaysOnMarket` | ✅ `marketStats.py`, `mlsDataBase.ts` | Averaged per city |
| `PropertyType` | ✅ `marketStats.py`, `recommendations.py` | Hard-filtered to `Residential` everywhere |
| `PropertySubType` | ✅ `mlsDataBase.ts` | Selected, not filtered on |
| `LivingArea` | ✅ `marketStats.py`, `recommendations.py` | Denominator for price-per-sqft |
| `LotSizeAcres` / `LotSizeSquareFeet` | — | Present, unused |
| `BedroomsTotal` / `BathroomsTotalInteger` | ✅ `mlsDataBase.ts` | Selected for comp display |
| `YearBuilt` | ✅ `mlsDataBase.ts` | Selected |
| `City` | ✅ everywhere | Primary grouping key |
| `PostalCode` | — | Present, unused — city + zip market-level join isn't implemented, only city |
| `Latitude` / `Longitude` | — | Present, unused |
| `UnparsedAddress` | ✅ `mlsDataBase.ts` | Display field for comps |
| `ListAgentFirstName`/`LastName`/`FullName`, `BuyerAgentFirstName`/`LastName` | ✅ (full name only) `mlsDataBase.ts` | |
| `ListOfficeName` / `BuyerOfficeName` | ✅ `mlsDataBase.ts` | Selected, not displayed |
| `PoolPrivateYN` / `ViewYN` / `FireplaceYN` | — | Present in schema, not selected in `getSoldComps` (only used on the `rets_property` side) |
| `NewConstructionYN` | — | Present, unused |
| `GarageSpaces` | — | Present, unused |
| `AssociationFee` | — | Present, unused on this table (HOA filtering only implemented against `rets_property`) |
| `SubdivisionName` | — | Present, unused |
| `HighSchoolDistrict` | — | Present, unused |
| `ListingContractDate` / `PurchaseContractDate` | — | Present, unused — would enable a true "time to accepted offer" metric distinct from `DaysOnMarket` |

## Obvious next extensions (not built, just noted)

- `L_Remarks` (full-text) feeding the embeddings pipeline live, instead of a fixed 100-listing sample.
- `LMD_MP_Latitude`/`Longitude` for radius-based search.
- `PreviousListPrice` for "recently reduced" queries.
- `PostalCode`-level (not just city-level) market aggregation.
