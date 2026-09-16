# IDX AI — Multi-Agent Real Estate Assistant

A production-style multi-agent AI assistant built on [OpenClaw](https://github.com/openclaw/openclaw), for the IDX Exchange AI Agentic Engineer internship (Summer 2026). It answers natural-language questions over two real MLS datasets via WhatsApp — property search, market analytics, comp-validated recommendations, and a RAG-grounded knowledge base — with an email agent for reports and alerts, gated behind an explicit human-approval step.

## What it does

- **Natural language property search** over active listings, with multi-turn follow-up questions when filters are missing (city, budget, type, beds).
- **Market analytics** — average price/sqft, days on market, list-to-close ratio, per city, computed live from sold-comps data.
- **Comp-validated recommendations** — hybrid scoring (60% structured attributes + 40% semantic similarity on listing descriptions) against a sold-comps validation check.
- **RAG knowledge assistant** — answers real-estate terminology/definitions grounded in indexed source documents, not the model's own training data.
- **Multi-agent orchestration** — a single intent classifier routes each message to the right specialist agent, or splits it across several for mixed-intent queries.
- **WhatsApp as the primary interface** — the whole system is reachable as one WhatsApp contact.
- **Email agent with draft-then-approve** — weekly market reports and listing alerts are drafted and previewed first; nothing sends until you explicitly reply "approve."

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full request-flow diagram, [`docs/SCHEMA.md`](docs/SCHEMA.md) for field-level database notes, and [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) for the capstone demo walkthrough.

## Tech stack

- **Agent runtime:** [OpenClaw](https://github.com/openclaw/openclaw) — WhatsApp channel, skill/tool routing, session management.
- **LLM:** Google Gemini (`gemini-3.1-flash-lite`, fallback `gemini-3-flash-preview`) via the `google-genai` SDK — used instead of OpenAI per the program handbook's stated provider flexibility.
- **Orchestration layer:** TypeScript (`agent/skills/`), invoked by OpenClaw's `idx-assistant` skill via a CLI entry point (`orchestratorCli.ts`).
- **Data/ML layer:** Python (`analytics/`) — MySQL queries via SQLAlchemy, Gemini embeddings for semantic search, a hand-rolled RAG pipeline.
- **Database:** MySQL, two tables — `rets_property` (~53K active listings) and `california_sold` (~87K sold transactions/comps).
- **Email:** nodemailer over Gmail SMTP (app password required, not your account password).

## Project layout

```
agent/skills/
  propertyQueryParser.ts   NLP filter extraction (city, price, beds, type, pool, etc.)
  mlsDataBase.ts           MySQL queries: searchActiveListings(), getSoldComps()
  sessionManager.ts        In-memory per-user session (city/budget/filters/pending email draft)
  sessionDB.ts             MySQL-backed session persistence (built, not currently wired in)
  emailAgent.ts            draftEmail() / sendApprovedEmail(), market-report + listing-alert builders
  orchestrator.ts          classifyIntent() + orchestrate() — the actual multi-agent router
  orchestratorCLI.ts       CLI entry point; this is what OpenClaw's idx-assistant skill execs
  emailSafetyTest.ts       Guardrail test suite for the email draft/approve flow
  chatTest.ts / cli.ts / priceTest.ts   Earlier dev-time test scripts, superseded by orchestrator.ts

analytics/
  marketStats.py           City-level market summaries and price trends (california_sold)
  embeddings.py            Gemini embeddings over listing remarks -> listing_embeddings.json
  recommendations.py       Hybrid scoring recommender + comp validation
  rag.py                   Chunk/index/retrieve/answer pipeline over analytics/knowledge/*.md
  recommend_cli.py         CLI wrapper around recommend_similar()
  knowledge/               Source documents indexed by the RAG pipeline
```

## Setup

1. **Environment** — Node (via OpenClaw's own install) and Python 3 with a project-local venv:
   ```bash
   python3 -m venv venv
   venv/Scripts/python.exe -m pip install pandas mysql-connector-python sqlalchemy scikit-learn numpy google-genai python-dotenv
   ```
   Important: any code that shells out to Python (see `orchestrator.ts`'s `PYTHON` constant) must reference `venv/Scripts/python.exe` explicitly — bare `python` on PATH resolves to a different interpreter without these packages installed.

2. **MySQL** — import both datasets into the `idx_exchange` schema (`rets_property.sql`, `california_sold.sql` at the repo root).

3. **`.env`** (repo root):
   ```
   GEMINI_API_KEY=...
   MYSQL_HOST=localhost
   MYSQL_USER=...
   MYSQL_PASSWORD=...
   MYSQL_DATABASE=idx_exchange
   EMAIL_USER=your_gmail_address
   EMAIL_PASSWORD=your_gmail_app_password   # not your real Google password
   ```

4. **OpenClaw** — `openclaw onboard`, link WhatsApp via `openclaw channels login --channel whatsapp`, then the `idx-assistant` skill (`~/.openclaw/workspace/skills/idx-assistant/SKILL.md`) wires WhatsApp messages to `orchestratorCli.ts` via `exec`.

## Testing

```bash
cd agent/skills
npx ts-node emailSafetyTest.ts                                   # 6 guardrail checks, no live send
npx ts-node orchestratorCli.ts "your message here" "<user-id>"   # exercise the full orchestrator directly
```

## Known limitations

- `recommend_similar()` only covers a 100-listing embedded sample, not the full ~53K `rets_property` rows (Gemini free-tier embeddings quota).
- Intent classification is keyword-based, not LLM-based — misroutes genuinely ambiguous or cross-referential queries.
- Mixed-intent handling only covers search+market; search+knowledge combinations aren't split yet.
- `recommendationAgent`'s `execSync` calls are synchronous despite the `Promise.all` wrapping around them — not true parallelism.
- RAG's glossary/schema documents (`analytics/knowledge/`) are self-authored, not official IDX/Trestle documentation.
- Running on Gemini's free tier: expect ~30-45s response latency, and occasional transient errors under load. This is an accepted constraint of the project, not a bug — see the capstone demo script for how it's handled live.
