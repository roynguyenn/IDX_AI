# Architecture

## Request flow

```mermaid
flowchart TD
    U["User on WhatsApp"] -->|message| OC["OpenClaw Gateway<br/>(WhatsApp channel)"]
    OC -->|reads SKILL.md, decides to invoke skill| SK["idx-assistant skill<br/>exec: orchestratorCli.ts"]
    SK --> ORCH["orchestrator.ts<br/>classifyIntent()"]

    ORCH -->|search| PSA["propertySearchAgent"]
    ORCH -->|market| MSA["marketStatsAgent"]
    ORCH -->|recommend| RA["recommendationAgent"]
    ORCH -->|knowledge| RAG["ragAgent"]
    ORCH -->|email| EDA["emailDraftAgent"]
    ORCH -->|mixed| MIX["search + market in parallel"]

    PSA --> PARSER["propertyQueryParser.ts<br/>(NLP filter extraction)"]
    PSA --> SESS["sessionManager.ts<br/>(city/budget/beds/type,<br/>pendingEmailDraft)"]
    PSA --> DB1[("rets_property<br/>~53K active listings")]

    MSA -->|execSync, venv python| PY_STATS["marketStats.py<br/>get_city_market_summary()"]
    PY_STATS --> DB2[("california_sold<br/>~87K sold comps")]

    RA -->|execSync, venv python| PY_REC["recommendations.py<br/>recommend_similar()<br/>+ validate_with_comps()"]
    PY_REC --> EMB[("listing_embeddings.json<br/>100-listing sample")]
    PY_REC --> DB2

    RAG -->|execSync, venv python| PY_RAG["rag.py<br/>rag_answer()"]
    PY_RAG --> IDX[("rag_index.json<br/>glossary + schema ref<br/>+ Week 5 market summary")]

    EDA --> SESS
    EDA -->|draft, pending_approval| WAIT{"user replies<br/>'approve'?"}
    WAIT -->|yes| SEND["sendApprovedEmail()<br/>nodemailer / Gmail SMTP"]
    WAIT -->|no| END1["nothing sent"]

    PSA & MSA & RA & RAG & EDA -->|formatted reply| OC
    OC -->|reply| U
```

## Why it's shaped this way

- **One entry point, five specialists.** `orchestrate()` in `orchestrator.ts` is the only thing OpenClaw ever calls (via `exec`). It classifies intent with a small keyword-based rule set (`classifyIntent()`) rather than a second LLM call — cheaper and faster, at the cost of misrouting genuinely ambiguous queries (see README limitations).
- **TypeScript orchestrates, Python computes.** The agent-facing layer (intent routing, session state, WhatsApp formatting) is TypeScript; anything statistical or ML-adjacent (SQL aggregation, embeddings, RAG retrieval, recommendation scoring) is Python, called via `execSync`. The one recurring gotcha: bare `python` on PATH resolves to the system/Conda interpreter, not the project's `venv` — every `execSync` call must reference `venv/Scripts/python.exe` explicitly or the dependent packages (`mysql-connector-python`, `google-genai`, etc.) won't be found.
- **Session state is the approval gate.** The email agent never sends on the same turn it drafts. `pendingEmailDraft` lives on the same per-user session object as search filters, and only a follow-up message matching an approval pattern (`"approve"`, `"confirm"`, `"send it"`) triggers the actual `nodemailer` call — enforced in code, not just prompted for.
- **Two databases, joined loosely.** `rets_property` (active listings, IDX's own legacy field names) and `california_sold` (historical comps, RESO/Trestle-standard field names) aren't foreign-keyed together in the schema; the join is done at query time on `L_ListingID` / `ListingKey`, or on city + postal code for market-level analysis. See `docs/SCHEMA.md`.
