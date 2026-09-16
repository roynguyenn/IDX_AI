# Capstone Demo Script

Follows the handbook's suggested structure (one sequenced flow through WhatsApp, not a feature checklist), adapted with real example queries already verified working against this project's actual data.

## Reality check on timing first

The handbook's 5-minute script assumes near-instant replies. This project runs on Gemini's free tier, which realistically takes **~30-45 seconds per turn**, and occasionally errors once before succeeding. Six message turns at that pace is 3-4.5 minutes of dead air alone — that doesn't fit in 5 minutes of *live* demo with any narration room to spare.

**Plan accordingly:**
- Talk *while* waiting for each reply (walk through what the query is testing, what agent will handle it) rather than staring at the phone in silence.
- Have the **backup demo video** (a screen recording from a run that already went cleanly) ready to cut to if the live run stalls or errors twice — the handbook explicitly expects this, it's not a fallback to be embarrassed about.
- If time is tight live, cut the multi-turn refinement beat (#2 below) first — it's the most skippable without losing coverage of a required capability, since session memory can be described rather than demoed live.

## The flow

### 1. Mixed-intent query (~90s + wait time)
**Send:** `Find affordable homes in Irvine and tell me if prices are rising`

Shows the orchestrator classifying `"mixed"` intent and running `propertySearchAgent` + `marketStatsAgent` **in parallel**, then merging both into one reply. While waiting: explain `classifyIntent()`'s keyword routing and that this is the one intent that fans out to two agents at once.

Known-good reference answer for the market half: Irvine averages **$811/sqft** (verified against `california_sold` directly — cite this if the live number ever looks off, since it confirms the pipeline is reading the real DB, not guessing).

### 2. Multi-turn refinement (~60s + wait time)
**Send (same thread, no restating filters):** `Actually make it under 900k`

Shows `sessionManager.ts` carrying `city`/`type` forward across turns — the reply should apply the new budget without you re-specifying Irvine. This is the beat to cut first if time runs short; describe it instead of demoing it.

### 3. Semantic search + recommendation (~60s + wait time)
**Send:** `Show me similar listings`

Triggers `recommendationAgent` — hybrid scoring (60% structured attributes: price/beds/city/sqft proximity, 40% semantic similarity on listing remarks embeddings), each result validated against `california_sold` comps for the same city/sqft band. Mention the known limitation here: recommendations are scored against a 100-listing embedded sample, not the full ~53K table (Gemini free-tier embeddings quota) — say this proactively, it reads as engineering awareness, not a gap you're hiding.

### 4. RAG knowledge question (~30s + wait time)
**Send:** `What's a list-to-close ratio?`

Grounded RAG answer pulled from `analytics/knowledge/glossary.md` — one of the three questions the RAG pipeline was validated against. Alternative if you want a second verified one: `What does DOM mean?` (Days on Market — confirmed working live on 2026-09-09, correctly distinguished from the generic tech "Document Object Model" reading, which is exactly why RAG grounding matters here).

### 5. Email draft-and-approve (~60s + wait time × 2, since this is two turns by design)
**Send:** `Send me a weekly market report to <your email>`

Shows the draft — a real report generated from `california_sold`, city-by-city — and the reply explicitly says **not sent yet**, with instructions to reply "approve." This is the one place the handbook says not to compress: the two-step gate is the actual safety feature, so show both halves.

**Send:** `approve`

Shows the send confirmation (or, if `EMAIL_USER`/`EMAIL_PASSWORD` aren't configured at demo time, the clean "could not send" failure message — still demonstrates the guardrail fails closed rather than silently, which is worth narrating either way).

## After the live segment

Save for the backup video / written reflection rather than the live slot (per the handbook's own guidance):
- The architecture diagram walkthrough (`docs/ARCHITECTURE.md`).
- The safety guardrail test suite passing (`emailSafetyTest.ts` — 6/6, screen-recorded once, doesn't need to run live).
- The Week 10 routing bug story (venv/PATH bug, `python` resolving to the wrong interpreter) — a good "what I'd do differently" reflection point: more integration testing of the `exec` path earlier, rather than trusting a script worked because it worked in isolation.
