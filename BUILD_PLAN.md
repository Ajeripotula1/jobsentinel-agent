# JobSentinel Build Plan

This is the source of truth for **what** we're building, **in what order**, and the **concrete steps** to get there. It's written curriculum-style: each slice names the concepts it's meant to teach, not just the deliverable. Checkboxes track progress — check one off as it's actually done (`- [ ]` → `- [x]`), don't batch-check ahead of the code. Update this file if scope, order, or tasks change — don't let it silently drift from what's actually being built.

A task marked **(design exercise — you write this)** is intentionally left unspecified: figuring it out is the point of the slice, not scaffolding. Everything else is infra/plumbing concrete enough to just execute.

## Methodology: vertical slices, not full layers

As of 2026-09-13 this replaced an earlier layer-by-layer plan (fully build the data layer, then the agent, then the backend, then the frontend). That order was inefficient here specifically because we don't know what data/schema/backend the agent actually needs until we've built and tested it.

Instead: each slice is a small, complete, testable capability that cuts across whatever layers it needs — data, DB, backend, agent, frontend — building only as much of each as that capability requires, not the full layer. No slice starts until the previous one is runnable and testable on its own. The sequence is ordered to reach real agent development and evaluation as early as possible; conventional CRUD/infra work (company following, a broad API surface, auth, deployment, hardening) comes after the core agentic loop is validated, not before.

This still means clean architecture and no unnecessary rework — see the hard architectural rules in `CLAUDE.md`/`README.md` (API never calls Bedrock directly, agent never calls the API, shared data-access module). Building incrementally doesn't mean building sloppily; it means not building more of a layer than the current slice needs yet.

## Feature classification (from README's Key Features)

| Capability | Agentic? | Why |
|---|---|---|
| Research Company (web search, background tool only — no dedicated UI) | Yes | Multi-source retrieval + reasoning, non-deterministic what it uses |
| Score Fit (job vs. profile) | Yes | Reasoning over retrieved facts, not a fixed formula |
| **Job Agent** — resume tailoring, cover letter, fit Q&A (one agent, one shared session per job) | **Yes — the core feature** | Multi-turn; the agent decides what's missing and when it's done. Originally two separate capabilities (Resume Optimization, Cover Letter); merged into one agent with a shared toolset — see the scope decision below |
| [Stretch] Mock Interview & Prep Agent | Yes | Multi-turn, adaptive to answers |
| Company following (add/remove board token) | No | Plain CRUD |
| Job polling & ingestion | No | Scheduled fetch + upsert, deterministic |
| Board-token inference ("try to infer... with logic") | No | A slug-guessing heuristic against known ATS URL patterns — deliberately not an LLM call |
| Job feed display + position filtering | No | Already built (`positions.py`) — deterministic alias matching |
| Save/track/analytics [stretch] | No | CRUD + aggregation |
| Resume/profile extraction from an uploaded resume | No (by decision) | A single structured-extraction LLM call — a utility step, not the agent. The interview is where genuine agent behavior on the profile begins. |

## Scope decisions (locked in for MVP)

*Several of these were MVP-only and are lifted by later stages; each is marked where that happens.*

- **Single-user.** No real multi-tenant auth yet. Clerk is a late slice. *(Superseded: Clerk arrived in Slice 6.5; per-user follows arrive in Stage 3.)*
- **Resume input is a PDF upload** (`POST /profile/upload`, Slice 2) — PDF text is extracted server-side via `pypdf` and fed into the extraction utility. No OCR/scanned-image support - a PDF with no text layer is a clear 422, not a silent empty extraction. (A raw-text `POST /profile` existed briefly alongside it; removed once PDF upload covered real usage and the raw-text HTTP route had no user-facing purpose left. `extract_profile()` itself still takes plain text directly - that's what `tests/test_extract_profile.py` calls.)
- **Company following is hardcoded board token(s) for early slices.** Real follow/unfollow CRUD arrives once the core agent loop is validated (Slice 7). *(Lifted in Stage 2 (seeded companies) and Stage 3 (follow/unfollow).)*
- **Greenhouse only for real ingestion in early slices.** Ashby/Lever exploration is already done (Slice 0); ingestion pollers for them are a later addition, not MVP. *(Lifted in Stage 2, Slice 8.)*
- **Resume/profile extraction is a plain single LLM call, not agentic** — see classification table above.
- **Company research (web search tool) is deferred until after fit-scoring is validated** (Slice 6, not Slice 3) — avoids picking a search API/dealing with its cost and latency before the core loop is proven. It is also never its own user-facing step (see the Job Agent decision below) — purely a background grounding tool for the Score Fit Agent and the Job Agent.
- **Embeddings/pgvector fit-matching is deferred to a stretch slice** (now Stage 7, Stretch). Naive DB lookups (fetch-by-ID, simple filters) are enough while the agent loop itself is being validated — there's no multi-job search need until Slice 7's job feed exists.
- **Minimal real Postgres tables from Slice 1 onward**, not flat-file fixtures — local Postgres is already running (Slice 0). Each slice adds only the columns it needs, not the full schema up front.
- **Resume tailoring, cover letter drafting, and fit Q&A are ONE agent (the "Job Agent"), not three separate agents, and not a master-orchestrator-plus-sub-agents split.** Decided via brainstorming before Slice 5 started. Reasoning: all three share the same job, the same profile, and the same grounding rules, and happen sequentially within one conversation, not in parallel — splitting them into separate agents (or a master agent delegating to sub-agents) would just mean manually relaying context between them that one shared session gives you for free, and none of the three need a distinct persona or isolated scratch-space that would justify the added complexity. The one exception: if Company Research (Slice 6) grows into genuinely multi-step exploration, that specific capability is a reasonable candidate to become a nested agent-as-tool later (an `Agent` call wrapped in a plain `@tool` function — Strands has no dedicated class for this) so its internal search/synthesis mess stays out of the main conversation. Not needed for MVP.
- **The Job Agent is gated behind a successful Score Fit run for that job.** You invest in tailoring only after deciding, via Score Fit, that the job is worth pursuing. Its opening message references the stored score/gaps rather than starting cold (requires a real, queryable "has Score Fit run for job X" record — see Slice 5's gating-requirement bullet, not yet built).
- **Cross-session/cross-job memory (AgentCore Memory) is short-term-per-job + long-term-per-user, not one flat memory.** Short-term memory scoped to `(user, job)` is what lets the Job Agent recall what Score Fit found for *that* job without manual prompt-seeding; long-term memory scoped to the user only is what lets a stated preference ("wants fast-paced startups") surface again in a *different* job's session later. AgentCore Memory informs the agents' own reasoning — it is never the backing store for app/UI logic (e.g. gating), which stays in Postgres.

## Re-scope note (2026-09-19)

After Slice 5 (AgentCore Memory short-term tier), the project paused to scope down: the original Slices 6-9 below described web search, a productionized poller, companies CRUD, embeddings, auth, and AWS deployment as one long forward march, with no clear line around what's actually needed for a working local MVP. The goal from here is a backend that runs locally today, so a frontend can be built against it tomorrow, with deployment or stretch features after that.

Old Slices 6-9's forward-looking content is replaced below by a new Slice 6 (the actual scope of this session — closing the two real gaps in the existing API surface, nothing more) and a "Deferred / Post-MVP" section. Nothing is dropped, only resequenced — see that section for exactly what's pushed out and why, per this file's own rule not to let scope drift silently. *(2026-09-27: that Deferred section has since been replaced by Stages 2–7 at the end of this file. Every item it held now lives in a numbered slice or in the Stage 7 backlog.)*

## Roadmap at a glance (updated 2026-09-27)

The slices below are grouped into **stages**. Each stage ends at a product milestone you could demo on its own. Slices inside a stage still follow the vertical-slice rule: each one is runnable end to end before the next starts.

| Stage | Milestone ("done" means…) | Slices | Status |
|---|---|---|---|
| **1. MVP** | One user can upload a resume, browse jobs, score fit, and work with the Job Agent in a real browser, locally | 0–7 | ✅ Built. Only Slice 7's real-browser walkthrough remains |
| **2. Multi-company** | Jobs from many companies across Greenhouse, Ashby and Lever, loaded through shared ingestion code in the package (not `scripts/`) | 8 | ✅ Built. Browser check pending |
| **3. Personalized feed** | Users follow companies, set target roles, and see a focused feed of only their jobs | 9 | ⬜ Next |
| **4. Polling** | Boards refresh on a schedule on their own; new and closed postings are detected and surfaced | 10 | ⬜ |
| **5. Custom companies** | Users can follow a company outside the seed list; its board token is resolved automatically | 11 | ⬜ |
| **6. Ready for deployment → deployed** | Per-user cost limits, then everything running on AWS at the ~$2–6/mo idle target | 12–13 | ⬜ |
| **7. Stretch** | Long-term memory, company research, embeddings matching, mock interview agent, notifications, etc. | — | ⬜ Unordered backlog |

**Core product = Stages 1–6.** That's the product pitched in `README.md`/`CLAUDE.md`: follow companies, boards are polled for you, relevant postings surface, and the agent helps you apply without inventing experience. Stage 7 is everything that makes it better but isn't needed for that loop to work.

Stage order reasoning: the job data model (Stage 2) comes first, because follows, feeds and polling all depend on jobs belonging to a company. Polling (Stage 4) comes before custom companies (Stage 5), because a newly added company should be fetched immediately by the *same* per-company fetch function the poller uses. Building it twice would be wasted work. Cost controls (Slice 12) come before deploy (Slice 13), because deploying opens billed Bedrock calls to anyone who can sign up.

---

# Stage 1 — MVP (Slices 0–7) ✅

Milestone: the full agent loop works for one signed-in user in a real browser, locally. Everything below in this stage is built; the only open items are the real-browser walkthrough (Slice 7) and the signed-in token check it covers (Slice 6.5). Slice 5's two unchecked items were moved to Stage 7.

## Slice 0 — Foundation (done)

*Teaches:* monorepo/package layout, 12-factor config, reading a third-party API's real shape before designing a schema against assumptions, recognizing structural differences across similar-but-not-identical APIs.

- [x] Package scaffolding, `pyproject.toml`, local Postgres+pgvector via `docker-compose.yml`, `jobsentinel.config.Settings`, smoke test
- [x] `scripts/explore_greenhouse.py`, `scripts/explore_asby.py`, `scripts/explore_lever.py` — raw data pulled and inspected against live boards for all three ATS's
- [x] `scripts/positions.py` — `CANONICAL_POSITIONS` alias map + title-variance-aware filtering, reused unmodified across all three ATS scripts

## Slice 1 — Job data the agent can read (done)

Goal: at least one real job posting's text is durably queryable, via a data-access function the agent will call directly in Slice 3.

*Teaches:* building only the schema a specific capability needs (not the full previously-planned 6-table schema up front), the shared data-access module pattern.

- [x] Normalize job-description extraction across all three ATS's before touching the DB: `scripts/job_text.py` (shared `html_to_text`/`clean_whitespace`/`normalized_job`/`summarize_jobs`) used by `explore_greenhouse.py` (HTML `content` field), `explore_asby.py` (plain `descriptionPlain` field), and `explore_lever.py` (combines `descriptionPlain` with the `lists` array, where Lever actually puts requirements/skills) — all three now produce the identical shape: `ats_job_id`, `source`, `board_token`, `title`, `description`, `url`, `fetched_at`, `raw_json`
- [x] **Switched to SQLAlchemy ORM + Alembic autogenerate** (was hand-written Core `Table` + hand-written migrations) — a deliberate tradeoff to spend less time on schema/migration mechanics and more on agent code. `jobsentinel/db/models.py`'s `Job` model (SQLAlchemy 2.0 `Mapped[...]`/`mapped_column` style) is now the single source of truth for the schema; `migrations/env.py`'s `target_metadata` points at `Base.metadata` so `alembic revision --autogenerate` can diff against it. Data-access functions still hand callers plain dicts, not live ORM objects — see `jobsentinel/db/jobs.py`'s `get_job` docstring for why (avoids the classic `DetachedInstanceError` footgun). Upserts still go through a Core-style `INSERT ... ON CONFLICT`, since the ORM has no native atomic upsert — standard even in ORM-first codebases.
- [x] `Job` model mirrors the normalized shape: `id`, `ats_job_id`, `source`, `board_token`, `title`, `description`, `url`, `raw_json` (JSONB), `fetched_at`, plus a `UNIQUE (source, ats_job_id)` constraint as the real dedupe key
- [x] Write `jobsentinel/db/jobs.py`: `upsert_job` (`INSERT ... ON CONFLICT (source, ats_job_id) DO UPDATE`, returns the internal `id`), `get_job(job_id)` — this is the shared module the agent calls directly in Slice 3 (never through the API — see the hard architectural rule)
- [x] Write `scripts/load_jobs.py`, the one-off loading script (reuses `explore_greenhouse.fetch_jobs`) that pulls one company's board and upserts postings into `jobs` — a basic upsert is fine; idempotency/backoff/scheduling is **not** required yet, that's Slice 7's productionized poller
- [x] Fixed a pre-existing scaffolding bug found while testing this: `.env`'s `DATABASE_URL` used a bare `postgresql://` scheme, which SQLAlchemy resolves to the psycopg2 dialect by default — but this project installs psycopg3 (`psycopg[binary]`). Every DB call would have failed with `ModuleNotFoundError: No module named 'psycopg2'` regardless of Slice. Fixed to `postgresql+psycopg://` in both `.env` and `.env.example`.
- [x] Declared `requests`/`beautifulsoup4` as real `pyproject.toml` dependencies (used by the exploration/loading scripts, previously only installed ad hoc)
- [x] Verified: `Job` model + `upsert_job`'s generated SQL both build correctly (checked the compiled `INSERT ... ON CONFLICT ... RETURNING` statement directly), and `alembic revision --autogenerate` gets all the way through model/metadata resolution before failing — only on the DB connection itself
- [x] `docker compose up -d`, `alembic revision --autogenerate -m "create jobs table"`, `alembic upgrade head`, `python scripts/load_jobs.py anthropic` — all run successfully
- [x] Confirmed rows landed: 594 rows in `jobs` from Anthropic's Greenhouse board
- [x] Fixed test case for Slices 2-4: **job `id = 182`** — "Full-Stack Software Engineer, Reinforcement Learning" (`ats_job_id 5186067008`, ~10.3k-character description)
  - *(2026-10-02)* After a later reload of the Anthropic board, this same posting (`ats_job_id 5186067008`) is now **job `id = 199`**; id 182 is a different posting. Entries below that mention 182 record runs made before that reload. Use 199 going forward.

## Slice 2 — Profile ingestion (resume → structured facts)

Goal: submit resume text over HTTP, get back structured facts, durably stored.

*Teaches:* the line between a utility LLM call and an agent, first FastAPI surface, request validation basics.

- [x] Added `fastapi`/`uvicorn` to `pyproject.toml` (Mangum/Lambda wrapping stays deferred to the deployment slice), plus `httpx2` as a dev dependency (needed by FastAPI's `TestClient`)
- [x] `jobsentinel/api/main.py` — the FastAPI app instance + a `/health` liveness check, with a `jobsentinel/api/routers/` package so each resource (profile now; jobs/interview/companies in later slices) gets its own router instead of main.py accumulating route handlers directly
- [x] `jobsentinel/api/routers/profile.py` — `POST /profile/upload` (PDF) routed, functional, and persisted; `GET /profile` returns the stored profile or `404` if nothing's been submitted yet. (A raw-text `POST /profile` existed briefly too - removed once PDF upload covered real usage and it had no remaining user-facing purpose; `extract_profile()` is still callable directly with plain text, which is what `tests/test_extract_profile.py` and the fixture files use.) Verified booting for real via `uvicorn` (not just `TestClient`) and hit all endpoints with `curl`.
- [x] Designed `jobsentinel/extraction/schema.py`'s `ExtractedProfile` (nested `Education`/`WorkExperience`/`Project`/`Certification` + flat `skills: list[str]`) **(design exercise)** — richer than the flat `profile_facts` shape originally sketched here; storage (next item) was designed against this shape instead
- [x] Designed & wrote the `profiles` table migration **(design exercise)** — one JSONB `data` column holding `ExtractedProfile.model_dump()` whole (`id`, `data`, `created_at`), not normalized per-section tables or flat `category`/`fact_text` rows. **Append-only history, not a singleton**: every submission inserts a new row with a new `id` rather than overwriting one row in place, so past resume versions stay queryable instead of being discarded. No `updated_at` - rows are never modified after insert. Still single-user for now ("no real multi-tenant auth yet" is still the locked-in scope); a `user_id` column arrives with Slice 9's real users, to scope "latest" per user
- [x] Ran the migration (`alembic revision --autogenerate -m "add profiles table"` → reviewed → `alembic upgrade head`; a follow-up migration dropped `updated_at` once the append-only design replaced the original singleton-row idea)
- [x] Wrote `jobsentinel/db/profile.py`: `insert_profile` (plain Postgres `INSERT ... RETURNING`, one new row per call) and `get_latest_profile` (most recent row by `id`)
- [x] Wrote the resume-extraction utility (`jobsentinel/extraction/extract.py`): one Bedrock Converse call (Claude Haiku 4.5, not Sonnet — bounded structured extraction doesn't need Sonnet-tier reasoning, see the model-choice discussion) forcing tool-use against `ExtractedProfile`'s JSON schema **(design exercise — this is a plain utility call: single request/response, no tool loop)**
- [x] Added PDF upload support (`jobsentinel/extraction/pdf.py`, `pypdf`) — `POST /profile/upload` extracts text server-side, feeds it through the extraction utility; scope extended from the original "raw text only" decision once actually needed. Once this covered real usage, the parallel raw-text `POST /profile` route was removed as redundant (see scope decision above) - `POST /profile/upload` is now the only submit route
- [x] Wired `GET /profile` (returns the latest submission) and persistence into `POST /profile/upload`
- [x] Ran locally via `uvicorn`; POST'd two different resumes in a row, confirmed both persisted as separate rows in Postgres (verified via `psql` directly - distinct `id`s, both `data` blobs intact) and `GET /profile` returned the most recent one
- [x] Unit tests for both remaining endpoints' wiring (`tests/test_profile_endpoint.py`) — extractor AND DB layer (`insert_profile`/`get_latest_profile`) both mocked, so these run with no Postgres up at all; request validation, PDF content-type/unreadable-PDF handling, 404-when-empty, two submissions produce two inserts (not one update)
- [x] Wrote a test for the extraction utility itself (`tests/test_extract_profile.py`, marked `integration`, excluded from the default `pytest -m "not integration"` run) — hits real Bedrock against the fixture resume, loose content-level assertions (e.g. "skills contains Python"), plus an explicit anti-hallucination check that `summary` stays `None` since the fixture resume has no summary section

## Slice 3 — Core agent: fit-score one job against a profile

This is the first real agent. It has to read as one — the model decides what to do, grounded only in tool results — not a fixed sequence with an LLM call inside.

*Teaches:* agent loop / tool-calling design, grounding responses in retrieved data instead of the model's own claims, deterministic testing of a non-deterministic system.

- [x] Add `strands-agents`, `boto3` to `pyproject.toml`
- [x] Confirm local AWS credentials have Bedrock model access for Claude Sonnet — Claude Sonnet 5 itself is still pending account-level Bedrock model access (see `Settings.bedrock_agent_model_id`); running on Claude Sonnet 4.6 in the meantime, same access path, swap the id back once granted
- [x] Write Alembic migration for `agent_runs` (`id`, `job_id`, `started_at`, `ended_at`, `outcome`, `input_tokens`, `output_tokens`, `cost_usd`) — token/cost accounting lives on the run record from the start, per the stack's "token budgets in the schema from day one" principle, without a separate table yet
- [x] Write Alembic migration for `tool_calls` (`id`, `run_id`, `tool_name`, `args`, `result`, `created_at`) — generated in the same migration as `agent_runs` (both added to `db/models.py` together), reviewed before applying
- [x] Implement tool `get_job(job_id)` — wraps Slice 1's `get_job` (named `get_job_info` in `jobsentinel/agent/main.py`)
- [x] Implement tool `query_profile_facts()` — wraps `jobsentinel.db.profile.get_latest_profile` (added back alongside Slice 2's now-id-scoped `get_profile(id)`, since the agent needs "the current profile" with no id in hand)
- [x] Wire both into a Strands `Agent` with a system prompt: score fit between the job and the profile, cite only what the tools returned, produce a score + written rationale **(design exercise — the prompt/scoring logic is the actual point of this slice)** — an initial version was hand-written; the full production prompt in `jobsentinel/agent/main.py`'s `SYSTEM_PROMPT` (0-100 score, grounding rules, fixed output sections) was written by Claude at explicit request to move the slice along faster, not as a self-directed design exercise — worth a closer read/iteration pass later even though it's tested and working
- [x] Write a CLI entrypoint, e.g. `python -m jobsentinel.agent.cli score <job_id>` — `jobsentinel/agent/cli.py`
- [x] Log every tool call to `tool_calls`, every run to `agent_runs` — `jobsentinel/db/agent_runs.py` (`start_run`/`end_run`/`log_tool_call`), tool calls logged from inside each tool in `main.py`'s `build_tools()`
- [x] Manually run it against Slice 1's test job + your real profile facts; check the rationale isn't citing anything the tools didn't return — ran `python -m jobsentinel.agent.cli score 182`: both tools called exactly once (verified directly in `tool_calls`), grounded rationale referencing specifics from the real job posting and profile, token usage + estimated cost recorded on the `agent_runs` row
- [x] **Iteration pass on the output format** (flagged above as worth revisiting): replaced the free-text markdown output (`**Fit Score: N**` + prose sections) with a validated schema, `jobsentinel/agent/schema.py`'s `FitAssessment` (`summary`, `strengths`, `gaps`, `match`, `recommendation_note`), forced via Strands' `structured_output_model` on the `Agent` — same tool-forced-schema mechanism Slice 2's `extract_profile` already uses via raw Bedrock Converse, just routed through Strands. Two decisions made via discussion before writing this:
  - **Dropped the numeric `fit_score` (0-100) entirely, replaced by a 5-value `Match` enum** (`strong_match` / `good_match` / `potential_match` / `weak_match` / `not_a_match`), each with a written definition in `MATCH_DEFINITIONS` that's interpolated into `SYSTEM_PROMPT` (single source, not duplicated prompt text). Reasoning: a holistic 0-100 ask is uncalibrated LLM-as-judge output — no real arithmetic behind it, drifts run-to-run — and a numeric fit_score would need either (a) the model to also freely pick a category, risking incoherent pairs like "92 / stretch," or (b) code-side thresholds mapping score→category, which is more machinery than a direct 5-value categorical judgment buys given the score's own calibration problem. A rubric'd category is still an LLM holistic judgment, not a true calculation — the further step (classify each requirement met/partial/not-met, compute the category deterministically in code) was discussed and deliberately deferred, not forgotten.
  - **`match` declared last in the schema, after `strengths`/`gaps`** — Strands fills structured-output fields in schema order, so the model writes out evidence before committing to a category, preserving the same "don't guess cold" anchoring the old prompt got from asking for prose before a score.
  - `gaps` distinguishes `gap_type` (`not_mentioned` / `contradicts` / `posting_underspecified`) rather than one flat bullet list, since "profile is silent" and "profile suggests the opposite" (and "the posting itself didn't say enough") are different situations needing different follow-up.
  - Added `agent_runs.result` (JSONB, migration `0ef692aa42a3`) storing `FitAssessment.model_dump()` on success — this is what makes the assessment queryable by field for the Slice 5 Job Agent and eventual UI, instead of re-parsing response text. `agent_runs.outcome` stays a short status string only.
  - Verified against job 182 again post-change: structured output validated, persisted, and queryable (`result->'match'`, `jsonb_array_length(result->'gaps')`) directly in Postgres.

## Slice 4 — Agent evaluation harness

Goal: a repeatable way to test agent behavior across multiple job/profile pairs, not just eyeballing one run.

*Teaches:* building an evaluation harness for a non-deterministic system; hallucination detection as an explicit, checkable test target.

- [x] Pick 3-5 real postings across different roles/companies (via the Slice 0 exploration scripts) and load them with Slice 1's loader — went with roles only, not companies: `scripts/eval_score_fit.py`'s `FIXTURE_JOB_IDS` picks 5 postings off the already-loaded Anthropic board, chosen to span match categories on purpose (a clear skills-domain mismatch, a seniority-only mismatch, an ambiguous customer-facing role, etc.) rather than real company diversity — revisit if cross-company differences (posting style/length, ATS quirks) turn out to matter once a second board is loaded
- [x] Write an eval script that runs Slice 3's `score` against each fixture job + your profile, printing results side by side — `scripts/eval_score_fit.py`, calls `jobsentinel.agent.score_fit.agent.invoke()` directly per fixture and prints a summary table plus full strengths/gaps detail per job
- [x] Write assertions against `tool_calls`/`agent_runs` (e.g. "both tools were called exactly once," "no call had empty args"), not exact model output text **(design exercise — note: implemented by Claude at the user's explicit request, not written by the user — see this slice's note below)** — `scripts/eval_score_fit.py`'s `check_run()` checks: each tool called exactly once, `get_job_info` called with no args (would only be non-empty if its closure binding regressed), neither tool's result is an error, and the run recorded `outcome="success"`/a `result`/a `cost_usd`. All 5 fixtures pass.
- [x] Manually review several runs for hallucination — does the rationale ever cite something not in your actual profile facts or the job text? This is the real test of the anti-hallucination design goal. — reviewed full strengths/gaps output across 3 independent runs of all 5 fixtures: every strength's evidence traces to a named project/employer/cert, gap_type usage (not_mentioned/contradicts/posting_underspecified) is used correctly and consistently, and the Account Executive fixture (job 1, deliberately picked as a hard domain-mismatch test) correctly scored `not_a_match` without inventing transferable sales skills. Match categories were stable across all 3 runs. One residual gap: every fixture skews weak_match/not_a_match because the profile is junior relative to Anthropic's mostly senior postings — a true strong_match/good_match case has never been exercised, so that calibration direction is still unverified.
- [x] Iterate on Slice 3's prompt/tools based on what you find before moving on — one real fix came out of building `check_run()`, not the hallucination review: `get_job_info(job_id)` in `jobsentinel/agent/score_fit/agent.py` took the job id as a model-supplied tool argument rather than a closure-bound one, the exact bug class already found and fixed in the Job Agent's `get_job_info` earlier this slice. It hadn't misfired across any fixture run, but nothing structurally prevented it. Fixed to match `profile_id`'s existing closure-bound pattern: `build_tools` now takes `job_id` as a parameter, `get_job_info()` takes no arguments, and `check_run()` asserts its logged args are always empty as a regression guard.

## Slice 5 — Job Agent: resume tailoring, cover letter, and fit Q&A (one agent, shared session)

Goal: one continuous agent — the "Job Agent" — that a user talks to about a specific job: it identifies gaps between profile and job, asks targeted questions, drafts a tailored resume and/or cover letter as text, and can answer open-ended questions about the fit — all in one session, routed by the model itself rather than by separate UI flows per capability.

*Teaches:* agent-decided control flow/termination, stateless multi-turn design over HTTP, session-scoped agent memory design, and recognizing when a capability split calls for one agent with more tools vs. genuinely separate agents.

Originally planned as two separate slices/agents (an interview → tailored-resume agent, then a cover-letter agent reusing the pattern); merged into one Job Agent via brainstorming before this slice started — see the locked-in scope decision above ("one Job Agent, not three, not a master-orchestrator-plus-sub-agents split") for the full reasoning.

- [x] **Gating requirement (do this first):** the Job Agent requires a successful Score Fit run to exist for this job before it's usable. Today nothing distinguishes *which capability* an `agent_runs` row was for, and the actual score isn't stored anywhere queryable (`outcome` is just `"success"`/`"error: ..."` text) — add whatever's needed to answer "has Score Fit run successfully for job X (for the current profile)" as a real query, not a re-run. Options: a `kind`/`capability` column on `agent_runs`, and/or a small table storing the score itself (or fold into Slice 7's `documents` table) **(design exercise — pick the shape)** — went with a `kind` column (`score_fit`/`job_agent`) on `agent_runs`, per `jobsentinel.db.agent_runs`'s `KIND_SCORE_FIT`/`KIND_JOB_AGENT` + `get_latest_successful_result`; the Job Agent's `invoke()` (`jobsentinel/agent/job_agent/agent.py`) checks this before doing anything else
- [x] Decide whether Postgres owns the Job Agent's turn-by-turn conversation log at all, or whether AgentCore short-term memory (below) replaces it — don't duplicate the same history in two systems. If Postgres does own it, generalize the originally-planned `interview_turns` table (`id`, `job_id`, `role` [agent/user], `content`, `created_at`) since it's no longer resume-specific **(design exercise)** — Postgres owned it temporarily (`job_agent_turns`, reloaded into a fresh `Agent` on every turn) so the Job Agent was testable before Memory existed. **Revisited and removed**: table dropped (`alembic downgrade` + deleted `334f6baf1117_create_job_agent_turns_table.py`), `jobsentinel/db/job_agent_turns.py` deleted, and `invoke()` no longer reloads/persists turns — every call is single-turn until the short-term tier below is wired in to replace it. See `job_agent/agent.py`'s module docstring for the TODO.
- [x] Wire up **AgentCore Memory**, two tiers:
  - **Short-term**, scoped to `(actor_id=user, session_id=job-{job_id})` — lets the Job Agent recall what the Score Fit Agent already found for this job with no manual "seed the prompt" plumbing, and keeps resume/cover-letter/Q&A continuous within one job's conversation. Scoped per job so different jobs' sessions never bleed into each other. **Done**: `jobsentinel/agent/shared/memory.py`'s `build_session_manager` wraps Strands' `AgentCoreMemorySessionManager` (from the `bedrock-agentcore` SDK's own Strands integration, not hand-rolled), wired into `job_agent/agent.py`'s `build_agent`/`invoke`. Resource created once via `scripts/setup_agentcore_memory.py`. Manually verified: stated a name + a "one question at a time" preference in one call, a second call (fresh process) recalled both; a different `job_id` correctly had no access to either.
  - **Long-term**, scoped to `actor_id` only (no job/session scoping) — durable, cross-job facts about the user surfaced during conversation (stated preferences like "wants fast-paced startups," "likes Rust, dislikes C"), available to every future session for that user. Populated via an extraction strategy over conversation transcripts (likely async, post-session) — **the extraction step needs the same anti-hallucination discipline as the live agent**: a single passing mention must not become a generalized trait. **Deliberately deferred, not dropped** — needs a memory strategy (namespace + extraction config) designed first; `build_session_manager`'s `retrieval_config` param already exists for it. Revisit before Slice 7's frontend, since cross-job recall is a user-facing feature, not just plumbing.
  - AgentCore Memory is the agent's semantic recall, not a replacement for the Postgres rows above — the UI's "has Score Fit run" gating stays backed by a real row, never derived from a memory query.
- [ ] **(→ moved to Stage 7, Stretch)** Implement tool `record_answer` — persists a user's answer as a new profile fact, `source="interview"` **(design exercise)** — originally implemented via `jobsentinel.db.profile.add_interview_note` into `ExtractedProfile.interview_notes`, tagged with the `job_id` the conversation happened in. **Removed** along with `job_agent_turns` above (same revisit) — `InterviewNote`/`ExtractedProfile.interview_notes` deleted from `jobsentinel/extraction/schema.py`, `add_interview_note` deleted from `jobsentinel/db/profile.py`. **Still deferred alongside long-term memory above** (same reasoning: writes through AgentCore Memory's long-term tier once that strategy/client exists, not back into the profile row).
- [x] Implement tool `mark_interview_complete` (or equivalent) — the agent calls this itself when it's done gathering what it needs; the only thing that ends that phase of the loop **(design exercise)**
- [x] Extend the Job Agent: given a job + profile (+ short-term memory of anything Score Fit already found), identify gaps, ask targeted questions, only draft resume/cover-letter text once it has enough — **hard rule: no fixed turn count in code** — "short-term memory of Score Fit" is the `get_fit_assessment` tool reading the Postgres row directly, not AgentCore Memory (still not wired up)
- [x] Implement the tailored-resume-rewrite capability: text output only, grounded in profile facts old and new **(design exercise)** — no separate tool/endpoint: SYSTEM_PROMPT's control-flow rule directs the model to draft this as plain conversational text once it has enough grounding, consistent with the "one agent, not three" scope decision
- [x] Implement the cover-letter-generation capability, grounded in profile facts + job text (no company research yet — that's Slice 6) — reusing the same gap-analysis/session rather than a separate flow **(design exercise — how much to reuse vs. build fresh per capability)** — same mechanism as the resume rewrite above, no dedicated code path
- [x] Give the Job Agent a way to just answer questions about the fit/gaps (reading the stored Score Fit result) without necessarily drafting anything — the "or anything else" part of the toolset — `get_fit_assessment` tool + SYSTEM_PROMPT rule 6
- [x] `POST /jobs/{id}/agent` (or similar) — start/continue a turn with the Job Agent (calls the agent core directly, never Bedrock from the API layer) — `src/jobsentinel/api/routers/jobs.py`'s `continue_job_agent`, an in-process call into `job_agent.agent.invoke()` (never a network hop), per `api/main.py`'s hard architectural rule
- [x] `GET /jobs/{id}/agent` — fetch conversation history — `read_job_agent_history`, reading straight from AgentCore Memory via `jobsentinel.agent.shared.memory.list_conversation` (no Postgres copy, consistent with this slice's earlier decision that Memory owns this, not a table)
- [x] Manually run a full session end-to-end: ask for resume help, then cover-letter help, then a fit question, all in one conversation with no restart; confirm it asks reasonable questions, stops on its own, and nothing drafted invents facts not in the profile/job text — validated across both the CLI and the new HTTP endpoints on job 182's session: gap-question answered, cover-letter requested, and the model correctly refused to invent facts (flagged the weak-match gaps instead of padding), with the whole thing continuous across process restarts
- [ ] **(→ moved to Stage 7, Stretch)** Manually confirm long-term memory works across jobs: state a preference in one job's session, start a session for a *different* job, confirm the Job Agent recalls (and cites) it without being told again — **blocked on the long-term tier above being implemented, not just short-term**

## Slice 6 — MVP backend surface: jobs API + Score Fit endpoint (2026-09-19)

Goal: serve the already-loaded jobs and the already-working Score Fit agent over HTTP, so a frontend can do: list jobs → view one → score it → (if scored) talk to the Job Agent → see conversation history. No new ingestion, no new agent capability — purely closing the two real gaps in the existing API surface (`GET /jobs` never existed; Score Fit was CLI/eval-only).

*Teaches:* recognizing when a thin CRUD-shaped router is genuinely all a capability needs (vs. Slice 3-5's agent work), reading/writing a plan document honestly when scope changes mid-project.

- [x] `jobsentinel/db/jobs.py`: add `list_jobs(engine) -> list[dict]` — summary fields only (id, title, source, board_token, url, fetched_at), no pagination/filtering (`positions.py` stays unwired — real need doesn't exist yet, see Deferred below)
- [x] `jobsentinel/api/routers/jobs.py`: `GET /jobs` (list, `JobSummary`), `GET /jobs/{id}` (detail, `JobDetail`, wraps existing `get_job`)
- [x] `jobsentinel/api/routers/jobs.py`: `POST /jobs/{id}/score` (always triggers a fresh in-process `score_fit.agent.invoke()` call, 422 on a bad/missing profile), `GET /jobs/{id}/score` (latest cached successful result via `get_latest_successful_result`, 404 if never scored) — mirrors the existing Job Agent route pair's pattern exactly
- [x] `tests/test_jobs_endpoints.py` — mocked DB/agent calls, no real Postgres/Bedrock needed, same pattern as `tests/test_profile_endpoint.py`; also backfilled tests for the pre-existing (previously untested) Job Agent turn routes
- [x] Delete `src/jobsentinel/poller/` (empty placeholder, imported by nothing) — recreate when the deferred poller work below actually starts
- [x] Fix `CLAUDE.md`'s stale "pre-code" Project Status section
- [x] Manually run the full flow against local Postgres + Bedrock: listed 594 jobs, viewed job 182's detail, read its cached Score Fit result, triggered a fresh Score Fit run on job 1 (correctly `not_a_match` for a sales role) and confirmed it's now served from cache, confirmed the pre-existing Job Agent turn/history endpoints still work unchanged

## Slice 6.5 — Minimal Clerk auth pass (2026-09-19)

Goal: pulled forward from Slice 9's "Clerk auth + multi-user row scoping" so Slice 7's frontend is built against a real multi-user API from day one, instead of retrofitting auth onto UI screens that all currently assume "the one profile." Backend-only — there's no frontend yet to actually sign a user in, so this is verified via unit tests with a self-signed test JWT (`tests/test_auth.py`), not a real browser sign-in; that's still Slice 7's job (`@clerk/clerk-react`'s `ClerkProvider`/`useAuth().getToken()`, attaching the token to every fetch).

*Teaches:* JWT/JWKS verification (asymmetric signature checking with no per-request call to the identity provider), the "trust the verified token everywhere downstream" pattern, why ownership checks belong at the boundary where a client-supplied id is resolved rather than deep in a tool.

- [x] `jobsentinel/api/auth.py` — `get_current_user_id`, a FastAPI dependency verifying a Clerk-issued bearer token against Clerk's JWKS (`jwt.PyJWKClient`, RS256) and returning the `sub` claim. Checks `iss` explicitly (proves the token is from *this* Clerk app); `aud` deliberately not checked (no JWT template configured). `Settings.clerk_issuer` (`CLERK_ISSUER` in `.env`) is the only new config - empty by default, raises loudly at first use rather than being a required field every process needs (same pattern as `bedrock_agent_memory_id`)
- [x] `profiles.user_id` column (migration `c883e877c432`) - nullable, same "historical rows predate this column" reasoning as `agent_runs.profile_id`. `jobsentinel/db/profile.py`'s `insert_profile`/`get_latest_profile` now require a `user_id`; `get_profile(id, user_id=None)` takes it as optional - pass the authenticated caller's id whenever `profile_id` is client-supplied (enforces ownership, a mismatch reads back as 404 not 403, so a caller can't distinguish "wrong id" from "someone else's id"), leave it `None` only for closure-bound tool call sites already checked upstream in the same request - see that function's docstring
- [x] Wired `get_current_user_id` into every route that touches profile data or costs Bedrock tokens: `POST/GET /profile*`, `POST/GET /jobs/{id}/score`, `POST/GET /jobs/{id}/agent`. `GET /jobs`/`GET /jobs/{id}` stay public - job-board data isn't user-specific yet (company following is still hardcoded/global), so gating them would add friction with no real access-control benefit today
- [x] `score_fit.agent.invoke`/`job_agent.agent.invoke` payloads gained a required `user_id` field - a plain trusted string handed down from the API layer (never verified by the agent itself; per the hard architectural rule the agent can't call back into the API to check a token anyway), used to scope `get_latest_profile`/`get_profile` and, for the Job Agent, as the AgentCore Memory `actor_id` (replacing the `SINGLE_USER_ACTOR_ID` constant) - see `jobsentinel.agent.shared.memory`'s docstring on why `actor_id` is load-bearing now, not just a label: `session_id` (`job-{job_id}-profile-{profile_id}`) alone isn't unique across users
- [x] `scripts/eval_score_fit.py` and `scripts/clear_agent_memory.py` updated to take `--user-id`/`--actor-id` instead of a shared constant
- [x] `tests/test_auth.py` - real JWT verification exercised against a locally-generated RSA keypair (valid token, expired, wrong issuer, forged signature), no real Clerk instance needed. `tests/test_profile_endpoint.py`/`tests/test_jobs_endpoints.py` override `get_current_user_id` via FastAPI's `dependency_overrides` (same "mock the external boundary" pattern as their existing DB/agent mocks)
- [x] Manually verified against the live app: `GET /jobs` succeeds unauthenticated; `POST /jobs/{id}/score`/`GET /profile` 401 with no/garbage token; a missing `CLERK_ISSUER` surfaces as a 500 (config error) rather than silently accepting the request
- [ ] **(closes with Slice 7's walkthrough)** Real end-to-end verification (an actual signed-in browser user's token reaching the API) - blocked on Slice 7's frontend actually existing; revisit once `ClerkProvider` is wired up there

## Slice 7 — Frontend (React/Vite)

Goal: a working UI over Slice 6's API — job list, job detail, a Score Fit button, a gated "Work with Job Agent" chat, conversation history, a profile upload/view page, and (per Slice 6.5) Clerk sign-in/sign-up gating the app itself.

**The step-by-step implementation plan for everything still unchecked below lives in `UI.md`** (hooks, components, endpoints, state, and per-step "done when" checks). It adds two dependencies to the stack decisions below — `react-markdown` + `@tailwindcss/typography` (agent replies are Markdown drafts) — and hardens `api/client.js` (typed `ApiError`, `FormData` support) before the hooks are written.

*Teaches:* consuming an agentic backend from a UI, progress states for multi-second agent calls (no token streaming — Mangum buffers responses, see CLAUDE.md's known tradeoff), wiring `@clerk/clerk-react` and attaching its session token to every API call, server-state caching with TanStack Query instead of hand-rolled `useEffect`/`useState`, and building UI from a copy-in-your-repo component system (shadcn/ui) rather than an installed black-box library.

**Stack decisions (finalized 2026-09-19):** Tailwind CSS + shadcn/ui for components/styling (industry-standard current pattern, even though its tooling defaults to TS — adapting it to this project's plain-JS choice is itself part of the lesson); TanStack Query (React Query) for all server state (jobs, profile, Score Fit results, Job Agent conversation) — given this app is a thin UI over Slice 6's API, this covers nearly all state needs, with `useState` reserved for genuinely local UI state (draft chat input, filter text); React Router for the four routes below; no form library — the only forms are a single file input and a chat textarea, not enough complexity to justify one yet.

- [x] **Backend fix (do this first):** `jobsentinel/api/routers/profile.py`'s `GET /profile` currently requires a client-supplied `id` — there's no way to ask "give me my current profile" without already knowing one. Make `id` optional; when omitted, resolve via `get_latest_profile(engine, current_user_id)` (already exists, already used internally by both agents) and 404 if the caller has never submitted one. Needed because the frontend has no `profile_id` to hand it on first load, and storing one client-side (`localStorage`) would break across devices/browsers instead of treating Postgres as the source of truth.
- [x] **Backend fix #2 (added 2026-09-21, found while planning the UI):** the FastAPI app has no CORS middleware, so a browser on `localhost:5173` can't call it (the `Authorization` header forces a preflight). Add `Settings.cors_allow_origins` + `CORSMiddleware` in `api/main.py`. Details in `UI.md` Step 0. Verified 2026-09-22: `OPTIONS /jobs` preflight returns `access-control-allow-origin`; note the gotcha this surfaced — CORS headers aren't attached to an *unhandled-exception* 500 response (Starlette's `ServerErrorMiddleware` sits outside `CORSMiddleware`), so a backend crash shows up in the browser as a misleading CORS error. Not a bug here, just something to remember when a "CORS" error shows up: check for a 500 first.
- [x] Scaffold the Vite React app (`npm create vite@latest frontend -- --template react`, plain JS, no TS) at the repo root's `frontend/`
- [x] Install & configure Tailwind CSS + initialize shadcn/ui (`npx shadcn@latest init`); pull in the specific components needed as they come up (button, input, card, badge, dialog/sheet for the chat, etc.) rather than the whole catalog up front — note: `npx shadcn@latest <cmd>` currently fails in this environment (`EALLOWSCRIPTS` — npx/`npm exec` leaks the global `.npmrc`'s `allow-scripts` value into env, which shadcn's internal `npm install` subprocess then trips as a blocked project-scoped override); use `npm run ui -- <cmd>` instead, which resolves the local devDependency binary directly and sidesteps it
- [x] Install `@clerk/clerk-react`; wrap the app in `ClerkProvider`; `/sign-in` and `/sign-up` routes using Clerk's hosted `<SignIn>`/`<SignUp>` components (no custom auth UI needed)
- [x] Install `react-router-dom`; routes: `/` (job list), `/jobs/:jobId` (job detail), `/profile`, `/sign-in`, `/sign-up`; wrap the first three in a `ProtectedRoute` using Clerk's `<SignedIn>`/`<SignedOut>` (or `useAuth()`)
- [x] Install `@tanstack/react-query`; set up `QueryClientProvider` at the app root
- [x] `frontend/src/api/client.js` — a thin fetch wrapper that attaches the Clerk session token (`useAuth().getToken()`) to every request to the FastAPI backend; one place all API calls route through, not one-off `fetch()`s per component
- [x] React Query hooks per resource, thin wrappers around `api/client.js` calls: `useJobs`, `useJob`, `useScoreFit` (query for `GET`, mutation for `POST`), `useJobAgentHistory` + `useSendJobAgentMessage`, `useProfile`, `useUploadProfile` **(design exercise — you write the hooks and the components that consume them; the setup above is scaffolding, this is the actual frontend logic)**
- [x] Job List page: table/list from `useJobs`, client-side substring filter on title (no backend pagination/filtering exists yet — 623 rows is small enough to filter in-browser) **(design exercise)** — built 2026-09-22; see `UI.md` Step 2 for the as-built shape (deviates slightly from that step's original spec) and the deferred `jobs.company`/ordering/`fetched_at` follow-up above.
- [x] Job Detail page: posting text from `useJob`; a Score Fit panel with idle/loading/result/error states (`useScoreFit`), rendering `FitAssessment`'s `match`/`strengths`/`gaps`/`recommendation_note`; a Job Agent chat gated on "has a successful Score Fit run for this job" (check whether `useScoreFit`'s `GET` 404s), with message history (`useJobAgentHistory`) + input (`useSendJobAgentMessage`) and a progress state for the multi-second reply (no streaming) **(design exercise — this is the core UI logic of the slice)**
- [x] Profile page: upload form (`useUploadProfile`) + rendering of the extracted `ExtractedProfile` facts (education/work/projects/certs/skills) from `useProfile` **(design exercise)**
  - *As built (2026-09-27, UI.md Step 5):* deviations from UI.md's spec — (1) both tab panels are `keepMounted` (added in Step 4 so an in-flight Score Fit run survives a tab switch), so the chat is rendered as `{canChat && <JobAgentChat/>}` inside a kept-mounted panel: no history GET fires until the job is scored, and once mounted an unsent draft now **survives** tab switches (UI.md had accepted losing it). (2) The "Score this job first" hint lives in `ScoreFitPanel`'s not-scored state, not as a `title` on the disabled trigger — a disabled Base UI tab is `pointer-events-none`, so the tooltip could never show (and tooltips don't exist on touch). (3) The signed-out "sign in to see your fit" card (Decision 10) links to `/sign-in?redirect_url=<this job>` so sign-in returns to the posting.
- [ ] Manually walk the full flow in a real browser: sign in, upload a resume, browse jobs, score one, chat with the Job Agent across multiple turns, refresh the page mid-flow and confirm everything reloads from the backend rather than depending on lost client state

# Stage 2 — Multi-company support

## Slice 8 — Companies, multi-ATS ingestion, and the job data model

Goal: jobs from a seeded list of companies across all three ATS's, stored with a real `company` relationship, loaded by ingestion code that lives in the package (the future poller Lambda can't import from `scripts/`). Still loaded by a one-off command; scheduling is Stage 4.

*Teaches:* normalizing several similar-but-different external APIs behind one interface (adapter pattern), foreign keys and data migrations on a table that already has rows, moving exploration code into production code without breaking the scripts that still use it.

- [x] `companies` table: `id`, `name` (display name), `source` (`greenhouse`/`ashby`/`lever`), `board_token`, `created_at`, `UNIQUE (source, board_token)`. Global, not per-user: a company is shared data, following it is per-user (Slice 9) **(design exercise — the schema)**
- [x] `jobs.company_id` FK → `companies.id`. Data migration: create the Anthropic company row and backfill the existing jobs (640 by then) to it before making the column `NOT NULL`. Done as expand → backfill → contract in one migration (`7236dc6bf4c1`): the migration inserts any missing `(source, board_token)` companies itself (placeholder `name` = `board_token`, overwritten by the seed), and names the FK explicitly (a `naming_convention` on `Base.metadata` was added afterwards, so future constraints get predictable names; it must restate the default `ix` key, or existing indexes lose their names)
- [x] Job data-model fixes (moved here from the old Deferred section, reasoning preserved):
  - Company display name comes from the `companies` row, not `board_token` (an ATS slug, not guaranteed presentable). Confirmed live that Greenhouse returns `company_name` per posting, so seed names can be checked against it
  - `posted_at` column from the ATS's own publish date (Greenhouse `first_published`; find the Ashby/Lever equivalents). Safe to overwrite on every re-poll, same as `title`/`description`
  - Rename `fetched_at` → `last_synced_at` (same overwrite-every-poll behavior, named honestly). Stage 4 relies on it for delisting
  - `location` (and a remote flag if the ATS exposes one) — look at real payloads first; all three ATS's shape this differently
  - Default `GET /jobs` ordering `posted_at DESC` in `list_jobs`'s `ORDER BY`, not alphabetical
  - *Built (migration `00f1e70971b1`):* `posted_at` (nullable timestamptz: Greenhouse `first_published`, Ashby `publishedAt`, Lever `createdAt` in epoch ms), `location` (nullable text, the ATS's own display string; Ashby/Lever multi-location joined with `; `), `workplace_type` (`remote`/`hybrid`/`onsite`/NULL: Ashby and Lever expose it directly; Greenhouse only via an optional "Location Type" metadata field or "remote" in the location text, so ~60% of Greenhouse rows are NULL, i.e. unknown rather than guessed). Autogenerate rendered the rename as drop + add, which would have deleted every timestamp; hand-edited to `alter_column(new_column_name=...)`. New columns are filled by re-running the loader, not a SQL backfill, so extraction logic lives in one place (the adapters). Titles are now `strip()`ed (400+ had padding). `list_jobs` orders `posted_at DESC NULLS LAST, id`, and joins `companies` once for the display name
- [x] `jobsentinel/ingestion/` package: move `job_text.py` (`normalized_job` etc.) and `positions.py` in from `scripts/`, plus one fetch function per ATS behind a common signature, e.g. `fetch_board(company) -> list[NormalizedJob]` **(design exercise — the adapter interface)**. `scripts/explore_*.py` and `load_jobs.py` import from the package afterwards instead of the reverse. Built as `jobsentinel/ingestion/jobs/{greenhouse,ashby,lever}_api.py`, each `fetch_jobs(board_token) -> list[dict]`, sharing one HTTP helper (`http.py`); the loader picks one via a `source -> fetch_jobs` dict
- [x] Seed list: ~10–20 real companies spread across all three ATS's, as a checked-in data file loaded by a seed command (not hardcoded in code), idempotent to re-run. Built as `jobsentinel/ingestion/companies/seed_companies.csv` + `python -m jobsentinel.ingestion.companies.seed_companies` (upserts by `(source, board_token)`)
- [x] `load_jobs.py` → loads every seeded company. One company failing (bad token, timeout) must log and continue, not abort the run. This is the first taste of Stage 4's per-company failure isolation. Built as `python -m jobsentinel.ingestion.jobs.load_jobs`: one company at a time, each written by `upsert_jobs` (batched multi-row `INSERT ... ON CONFLICT`, one transaction per company). First run: 7,047 jobs from 21/21 companies
- [x] API: `JobSummary`/`JobDetail` gain `company`, `posted_at`, `location`; `GET /companies` (public, list) for the frontend's filters. Also `company_id`, `workplace_type`, `last_synced_at`; `board_token` moved to `JobDetail` only. The agents' `get_job_info` tool now also returns company/location/workplace type, since those aren't reliably in the description text
- [x] Frontend: company column + company filter on the jobs table; "Last synced" column becomes "Posted"; company name in the job detail header instead of `board_token`. Filter options come from `GET /companies` (native `<select>`); the detail header also shows location and workplace type; `formatDate` renders `—` for a null date. Lint + build pass. **Not yet walked in a real browser** — fold into Slice 7's walkthrough
- [x] Re-check the Slice 4 eval harness with a couple of non-Anthropic postings (Slice 4 noted cross-company differences were never exercised). Posting styles/lengths vary a lot by ATS
  - Fixtures are now keyed by `(source, ats_job_id)`: the original `jobs.id` fixtures had all drifted onto unrelated postings after a board reload (same cause as the 182 → 199 test-job move). Added Cursor (Ashby, a ~400-char posting) and Binance (Lever, description stitched from `lists` sections)
  - Result (2026-10-02, one profile): all 7 runs completed, all tool-call assertions OK. Cross-ATS input is fine: the stitched Lever posting was read as one coherent posting (it found the Mandarin requirement buried in a section), and the short Cursor posting got `posting_underspecified` gaps instead of invented requirements
  - Calibration issues worth a Stage 7 eval pass, not fixed here: (1) the same requirement sometimes appears as both a strength and a gap (FDE: "production LLM experience"; Binance: "Node.js", with Python evidence offered as the strength); (2) an unmet years-of-experience minimum is `contradicts` in some runs and `not_mentioned` in others; (3) `good_match` on the 400-char Cursor posting is generous given how little it says

- [x] Row count check: if the total job count is now in the thousands, the client-side-only filter from Slice 7 is the thing to revisit in Slice 9, not here. **Measured: 7,140 jobs, `GET /jobs` = 2.4 MB uncompressed (no gzip), ~0.15 s server-side locally**, and the table renders every row. Slice 9's server-side feed is the fix; until then, `GZipMiddleware` is a one-line stopgap if it's noticeably slow

# Stage 3 — Personalized feed

## Slice 9 — Follow companies, target roles, and "my jobs"

Goal: a signed-in user follows companies, says which roles they want, and gets a focused feed of only matching jobs. The public all-jobs list stays for signed-out browsing.

*Teaches:* many-to-many relationships (users ↔ companies), per-user row scoping on shared data, when filtering moves from client to server (user-driven filters over a growing dataset), reusing deterministic matching (`positions.py`) instead of reaching for embeddings.

**Scope change (2026-10-04):** location / remote-ok preferences and a per-company "View jobs" button on the Companies page moved to Stage 7. The feed filters by followed companies and target roles only.

**Build order.** The slice is split into four features, 9a–9d. Each one goes through the whole stack (DB → API → frontend) and ends with a check in the browser before the next starts. Each has a wireframe as its visual target. The order is chosen so something visible works as early as possible. The feed (9b) comes before roles (9c) and starts as "every job from companies I follow". Roles then add a filter to a feed that already exists, so you're not building the feed and its filtering at the same time.

### Target site map (after 9d)

```
/                     HomePage            [CHG]  signed-in users go to /feed (9d)
/sign-in, /sign-up    Clerk               [SAME]
/feed                 MyJobsPage          [NEW]  auth; the signed-in default (9b)
/jobs                 JobListPage         [SAME] public all-jobs list, still reachable
/jobs/:jobId          JobDetailPage       [SAME]
/companies            CompaniesPage       [NEW]  public to browse, auth to follow (9a)
/profile              ProfilePage         [CHG]  Resume tab + Job preferences tab (9c)
```

```
Navbar, signed out:
+--------------------------------------------------------------------------+
| JobSentinel   All jobs   Companies                    [Sign in] [Sign up] |
+--------------------------------------------------------------------------+

Navbar, signed in:
+--------------------------------------------------------------------------+
| JobSentinel   My jobs   All jobs   Companies   Profile             (o)   |
+--------------------------------------------------------------------------+
               (9b)                  (9a)                        UserButton
```

---

### 9a — Follow companies

```
/companies — CompaniesPage
+--------------------------------------------------------------------------+
| Companies                                     [search companies...]      |
| Following 6 of 21                                                         |
+--------------------------------------------------------------------------+
| <CompanyCard/> grid                                                       |
| +----------------------+ +----------------------+ +----------------------+|
| | Anthropic            | | Cursor               | | Binance              ||
| | Greenhouse · 640 jobs| | Ashby · 42 jobs      | | Lever · 310 jobs     ||
| | [✓ Following]        | | [+ Follow]           | | [+ Follow]           ||
| +----------------------+ +----------------------+ +----------------------+|
+--------------------------------------------------------------------------+
   data:  GET /companies (exists) + GET /companies/following (which ones I follow)
   click: PUT / DELETE /companies/{id}/follow
   signed out: [+ Follow] -> /sign-in
```

- [x] DB: `user_companies` table (`user_id`, `company_id` FK, `created_at`, PK on `(user_id, company_id)`) + migration **(design exercise)**. Think about: what happens on a duplicate follow, and whether `ON DELETE CASCADE` on the company FK is right. **Done:** junction table (one row per follow, not an `int[]` per user - FKs can't cover array elements); `ON DELETE CASCADE`; separate index on `company_id` for the reverse "who follows Y?" lookup the poller will need
- [x] DB access: `follow_company` / `unfollow_company` / `list_followed_company_ids` in `jobsentinel/db/`. Following twice and unfollowing something not followed should both be harmless (idempotent). **Done** in `db/user_companies.py`, plus `list_followed_companies` (joined details + `followed_at`). Follow is `ON CONFLICT DO NOTHING ... RETURNING` - `rowcount` reads `-1` for that INSERT on psycopg
- [x] API: `PUT /companies/{id}/follow`, `DELETE /companies/{id}/follow`, `GET /companies/following`. All require auth and are scoped by `get_current_user_id`; 404 on an unknown company id. Tests cover: follow, double-follow, unfollow, user A can't see user B's follows. **Changed from plan (2026-10-05):** PUT instead of POST (follow is idempotent, which PUT promises and POST doesn't); `/companies/following` instead of `/me/companies` (lives in the companies router). Both return 204; unknown company id is detected by catching the FK violation, not a SELECT-first check
- [x] API: per-company job count on `GET /companies` (for the card's "640 jobs"). Optional; drop it if the query gets awkward. **Done:** `job_count` on the existing endpoint (not a new one), counted live with `LEFT JOIN jobs ... GROUP BY companies.id` + `count(jobs.id)` in `db.companies.list_companies_with_job_counts` - no stored counter to drift. Added the missing index on `jobs.company_id` (Postgres doesn't auto-index FK columns; 9b's feed joins on it too)
- [x] Frontend: `useFollowedCompanies` + `useFollowCompany`/`useUnfollowCompany` hooks; `CompaniesPage` with `CompanyCard` grid, name search, a "Following N of M" count, and a navbar link. **Convention from here on:** per-user query keys include the Clerk `userId` (`followedCompanies(userId)`, `enabled: !!userId`); pre-9a keys left as-is
- [ ] Try an **optimistic update** on the follow toggle (React Query `onMutate` + rollback in `onError`) **(design exercise)** - mutations currently invalidate-and-refetch, and a failed follow gives no user-facing feedback yet
- [ ] **Verify in browser:** follow 3 companies, refresh, still followed; unfollow one, refresh, gone; signed out, Follow sends you to sign-in. Check the `user_companies` rows in psql match

### 9b — My jobs feed (followed companies only)

```
/feed — MyJobsPage
+--------------------------------------------------------------------------+
| My jobs                                                                  |
| Following 6 companies                            [Edit companies]        |  <- FeedSummaryBar
+--------------------------------------------------------------------------+
| [search title...]  [Company: followed only v]                            |  <- JobsTable, reused
|--------------------------------------------------------------------------|
| Title                     | Company   | Location      | Posted           |
| Senior Software Engineer  | Anthropic | SF / Remote   | Oct 2            |
| ML Engineer, Inference    | Cursor    | Remote        | Sep 30           |
+--------------------------------------------------------------------------+
   data: GET /jobs/feed (server filters to followed companies)
```

- [ ] DB access: `list_feed_jobs(user_id)` — `jobs` joined to `user_companies` on the user, same ordering as `list_jobs` (`posted_at DESC NULLS LAST, id`)
- [ ] API: `GET /jobs/feed` (auth) returning `JobSummary` rows. **Decide the response shape now** **(design exercise):** a bare list, or an envelope like `{jobs, followed_count, has_roles}` so 9d's empty states don't need three separate queries. Changing it later means changing every consumer, so pick before 9c
- [ ] Frontend: refactor `JobsTable` to take its jobs (and loading/error state) as props, not call `useJobs()` itself, so `/jobs` and `/feed` share one table. `useFeed` hook; `MyJobsPage` with `FeedSummaryBar` ([Edit companies] → `/companies`); "My jobs" navbar link (signed in only)
- [ ] **Verify in browser:** `/feed` shows only followed companies' jobs; follow a new company on `/companies`, go back, its jobs appear (check your query invalidation); `/jobs` still shows everything

### 9c — Target roles (filter the feed)

```
/profile — ProfilePage, Job preferences tab
+--------------------------------------------------------------------------+
| Profile                                                                  |
| [ Resume ]  [ Job preferences ]                    <- tabs (ui/tabs.jsx) |
+--------------------------------------------------------------------------+
| Resume tab:  ProfileUpload / ProfileView  (unchanged)                    |
|--------------------------------------------------------------------------|
| Job preferences tab:  <PreferencesForm/>                                 |
|                                                                          |
|   Target roles (pick at least 1)                                         |
|   [x] Software Engineer   [x] AI Engineer   [ ] Data Engineer            |
|   [ ] Computer Engineer   [ ] ...   (keys from CANONICAL_POSITIONS)      |
|                                                                          |
|                                            [Save preferences]            |
+--------------------------------------------------------------------------+
   data: GET / PUT /me/preferences

/feed — FeedSummaryBar gains the roles line:
| Following 6 companies · Roles: Software Engineer, AI Engineer            |
|                                          [Edit companies] [Edit roles]   |
```

- [ ] DB: `user_preferences` with target positions (keys from `CANONICAL_POSITIONS`). One row per user with an array/JSONB column, or a row per (user, position); decide and note why **(design exercise)**. Leave room for Stage 7's location fields without designing them now
- [ ] API: `GET /me/preferences` (empty defaults rather than a 404 for a user who hasn't set any) and `PUT /me/preferences` (validates every key against `CANONICAL_POSITIONS`, 422 otherwise). Decide where the frontend gets the list of roles to show: hardcoded in the frontend (can drift from `positions.py`) or served by e.g. `GET /positions`
- [ ] API: `GET /jobs/feed` also filters by target roles via `positions.py`'s title matching **(design exercise — where matching runs: SQL vs. Python).** Python reuses `filter_by_positions` as-is but fetches every followed job first; SQL filters in the DB but duplicates the alias logic. Measure with a heavy follower (e.g. all 21 companies) before deciding. No roles set = no role filter (feed shows all followed jobs)
- [ ] Frontend: `usePreferences` / `useUpdatePreferences`; `PreferencesForm` in a new "Job preferences" tab on `/profile`; roles line + [Edit roles] on `FeedSummaryBar`. Saving invalidates the feed query
- [ ] **Verify in browser:** pick Software Engineer, feed shrinks to matching titles; add AI Engineer, ML titles appear; refresh, selections persist; clear all roles, full followed feed returns

### 9d — Empty states, landing, and the onboarding walk

```
/feed — <FeedEmptyState/>: only ONE shows, checked in this order
+--------------------------------------------------------------------------+
|  - no resume       -> "Upload your resume to score jobs"   [Upload]      |  (existing alert)
|  - no follows      -> "Follow some companies to build your feed"         |
|                                                   [Browse companies]     |
|  - no roles picked -> "Pick the roles you're looking for"  [Pick roles]  |
|  - 0 matches       -> "No matches. Try adding more roles"  [Edit roles]  |
+--------------------------------------------------------------------------+
```

```
New user:
 HomePage --[Get started]--> /sign-up (Clerk)
                                 |
                                 v
                              /feed  --(no resume)--> [Upload]
                                                         |
       +-------------------------------------------------+
       v
  /profile (Resume tab) --upload PDF--> ProfileView --"Next: follow companies"
       |
       v
  /companies --follow 3-5--> [Done → see my jobs]
       |
       v
  /feed --(no roles)--> [Pick roles]
       |
       v
  /profile (Job preferences tab) --save--> back to /feed
       |
       v
  /feed (populated) --click row--> /jobs/:id --> Score Fit --> Job Agent

Returning user:
 sign in --> /feed --> click job --> /jobs/:id --> Score / Agent
               |  [Edit companies] --> /companies --> back to /feed
               |  [Edit roles]     --> /profile (Job preferences) --> back to /feed
               +-- navbar "All jobs" --> /jobs

Signed out:
 HomePage --[Browse jobs]--> /jobs --click--> /jobs/:id (Score Fit asks to sign in)
          \--> /companies --[+ Follow]--> /sign-in
```

- [ ] Frontend: `FeedEmptyState` with the four cases above, in that order
- [ ] Frontend: "next step" links that connect the onboarding path: ProfileView → `/companies`, CompaniesPage [Done → see my jobs] → `/feed`, preferences save → `/feed`
- [ ] Frontend: signed-in landing. `/` redirects to `/feed` (or the HomePage CTA becomes "Go to my jobs"; pick one), and Clerk's post-sign-in redirect lands on `/feed`
- [ ] **Verify in browser:** walk the full new-user path with a fresh Clerk account (sign up → upload resume → follow companies → pick roles → feed → score a job), hitting each empty state along the way. Then the returning-user path, then signed out

# Stage 4 — Polling

## Slice 10 — Scheduled ingestion, delisting, and "new" jobs

Goal: boards refresh without anyone running a script, closed postings stop showing, and users can see what's new. Built and scheduled **locally** first (a CLI entry point plus the same handler function the Lambda will call). The EventBridge/Lambda deploy happens in Slice 13.

*Teaches:* idempotent batch jobs, failure isolation, observability for unattended work (you only find out it broke by looking at its records), designing for the Lambda handler shape before deploying it.

- [ ] Recreate `jobsentinel/poller/`: `run_poll()` fetches every company with **at least one follower** (or all seeds; decide, it drives cost and API load), upserts via the Slice 8 adapters, isolates each company's failure, and returns a summary. A thin `handler(event, context)` wraps it for Lambda later
- [ ] `poll_runs` table: one row per run (started/finished, companies ok/failed, jobs new/updated/closed) plus per-company errors, so a silent failure is visible **(design exercise — what's worth recording)**
- [ ] Delisting: a job not returned by its board on a successful fetch of that board is marked closed (`closed_at`/`is_active`), never deleted, because scores and chats reference it. Only mark closed when that company's fetch **succeeded**: a failed fetch must not close every job at that company
  - Then make `GET /companies`' `job_count` count open jobs only. The condition goes in the outer join's `ON` clause, not `WHERE` - a `WHERE` on a jobs column drops the NULL rows and turns it back into an inner join, hiding companies whose jobs are all closed
- [ ] Closed jobs: hidden from feeds by default; job detail still loads, with a "no longer accepting applications" banner; scoring/chat on a closed job is allowed but visibly flagged
- [ ] "New" jobs: reinstate `first_seen_at` (write-once, set on insert). It was cut from the old Deferred section for lacking a consumer; this is the consumer. Plus per-user "last viewed feed at" to drive a **New** badge and a "new since last visit" count
- [ ] Politeness: a small delay between requests, a timeout per fetch, and retry with backoff on 429/5xx only
- [ ] Tests: adapters mocked; cases for a failed company, a delisted job, a re-listed job, and re-running the same poll twice producing no duplicate changes

# Stage 5 — Custom companies

## Slice 11 — Add any company: board-token resolution

Goal: a user types a company (name or careers-page URL) that isn't in the seed list; JobSentinel finds its ATS board, adds it, fetches it right away, and the user follows it. Deterministic, not an LLM call (see the classification table).

*Teaches:* heuristic resolution against external systems, caching negative results, designing a UX for "we tried and couldn't," abuse-proofing a user-triggered outbound call.

- [ ] Resolver: (1) if given a URL, parse known ATS URL patterns directly (`boards.greenhouse.io/<token>`, `jobs.ashbyhq.com/<token>`, `jobs.lever.co/<token>`); (2) otherwise generate slug candidates from the name (lowercase, strip punctuation/spaces, drop suffixes like "inc"/"ai") and probe each ATS's public API **(design exercise — candidate generation and probe order)**
- [ ] A found board must have at least one posting, or ask the user to confirm (an empty board and a wrong guess look the same)
- [ ] Cache attempts, hits and misses, so the same name isn't re-probed on every request; misses expire
- [ ] `POST /companies` (auth): resolve → create company (or return the existing one; duplicates collapse on `UNIQUE (source, board_token)`) → immediate first fetch using the Stage 4 per-company fetch → auto-follow
- [ ] Limits: per-user rate limit on add attempts, a cap on probes per attempt
- [ ] UX: "Add a company" on the Companies page; a clear failure message listing what was tried, plus a fallback to paste the careers-page URL
- [ ] Newly added companies join the nightly poll automatically (they now have a follower)

# Stage 6 — Ready for deployment → deployed

## Slice 12 — Cost controls and production readiness

Goal: safe to let strangers sign up. Today any signed-in user can trigger unlimited billed Bedrock runs.

*Teaches:* token/cost budgets as a schema concern (per CLAUDE.md, "token budgets belong in the schema from day one"), rate limiting, deciding what the system should refuse.

- [ ] Per-user usage accounting from `agent_runs.cost_usd` (already recorded): daily/monthly spend per user **(design exercise — query vs. a running counter)**
- [ ] Budget enforcement before invoking an agent: over budget → a clear 429-style error the UI shows, not a silent failure. Separate limits for Score Fit runs and Job Agent turns
- [ ] Decision to record explicitly: scoring stays **on-demand only**. Auto-scoring every new matching posting nightly would break the idle-cost target
- [ ] Resume upload → S3 presigned upload (the API receives only the key). Lambda's 6 MB request-payload limit makes upload-through-the-API fragile
- [ ] Structured logging (JSON, a request id, user id, agent run id) across API, agent and poller
- [ ] Config audit: everything environment-specific comes from `Settings`, nothing hardcoded to localhost

## Slice 13 — AWS deployment

Goal: the three deployable units from `CLAUDE.md`'s architecture running on AWS, with the frontend served from S3+CloudFront.

*Teaches:* serverless packaging, IAM least privilege, secrets management, the difference between an in-process call and a network boundary.

- [ ] **Agent boundary:** the API currently calls `score_fit`/`job_agent` `invoke()` **in-process**. In production the agent runs in AgentCore Runtime, so the API needs an invoke-AgentCore client behind the same function signature (local dev can keep the in-process path via config) **(design exercise)**
- [ ] Supabase Postgres + pgvector; run Alembic migrations against it; move data
- [ ] API: FastAPI + Mangum on Lambda with a Function URL
- [ ] Agent: container image to AgentCore Runtime
- [ ] Poller: Lambda + EventBridge Scheduler (nightly), reusing Slice 10's `handler`
- [ ] Frontend: `npm run build` → S3 + CloudFront; production `VITE_API_BASE_URL`
- [ ] Secrets/config in SSM Parameter Store; IAM role per unit with only what it needs
- [ ] Clerk production instance; production CORS origin
- [ ] AWS Budgets alarm at the idle-cost target; CloudWatch alarm on poller failures (from `poll_runs`)
- [ ] Full walkthrough against production, including a second user to confirm isolation
- [ ] Update `CLAUDE.md`/`README.md` with deploy commands and the production architecture as built

# Stage 7 — Stretch (unordered backlog)

Nothing here is needed for the core loop. Pick by interest and learning value once Stage 6 is done; promote an item to a numbered slice before starting it.

- **AgentCore Memory long-term tier + `record_answer`** (moved from Slice 5's unchecked items): cross-job user facts ("wants fast-paced startups"). Needs a memory/extraction strategy designed first. Short-term per-job memory already covers the MVP.
- **Company research / web search tool**: a background grounding tool for Score Fit and the Job Agent, no dedicated UI. Possibly a nested agent-as-tool if it becomes multi-step (see scope decisions).
- **Embeddings/pgvector matching** (Titan V2, 1024d): rank the feed by profile similarity instead of title aliases only.
- **Location / remote preferences** (moved from Slice 9, 2026-10-04): optional target locations and a remote-ok flag in `user_preferences`, applied as a `/jobs/feed` filter and a field on the Job preferences tab. Needs a normalization decision first, since `location` is each ATS's free-text display string and `workplace_type` is NULL for ~60% of Greenhouse rows.
- **Company jobs view** (moved from Slice 9, 2026-10-04): a "View jobs" button on each Companies-page card, next to Follow, that opens the existing jobs table filtered to just that company (e.g. `/jobs?company=<id>`, reusing `JobsTable` and its company filter).
- **Follow from job detail** (2026-10-04): a [+ Follow] / [✓ Following] button next to the company name in the job detail header, so a company found while browsing the public `/jobs` list can be followed without going to `/companies`. Reuses Slice 9a's follow/unfollow endpoints and hooks; the only new work is reading follow state in `JobDetail` and sending signed-out users to sign-in.
- **Notifications**: email digest of new matching jobs (the "polls daily and tells you" experience), built on Slice 10's `first_seen_at`.
- **Mock Interview & Prep Agent**: standalone multi-turn agent.
- **Conversational job-query agent** ("find me backend roles at startups that…").
- **Save/track/analytics**: application status per job, simple funnel stats.
- **Streaming replies**: only if non-negotiable. Move the API to App Runner per `CLAUDE.md`'s known tradeoff; no workarounds on Lambda+Mangum.
- **Eval harness growth**: a real strong/good-match fixture (never exercised, see Slice 4), plus Job Agent evals (does it ask before drafting, does it ever invent facts).

## Extreme stretch

Only once everything above is worth doing and done.

- **Company catalog from Common Crawl**: build a catalog of `(ats, slug, display_name)` from Common Crawl's URL index (`boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`, plus their EU hosts), validated against each ATS's public API. It would power autocomplete and instant resolution in Slice 11 instead of live probing alone. A one-crawl Ashby spike (`scratch/ashby_cc.py`, run against the free CDX index server) found 1,333 slugs, with 23 of 25 sampled boards live, but missed Linear. So coverage needs several crawls unioned, and live probing stays as the fallback. A real build would use **Athena over the columnar index** (`s3://commoncrawl/cc-index/table/cc-main/warc/`, us-east-1; always filter on the `crawl`/`subset` partitions to keep scan cost low) as a monthly batch job. Open problems: display names (Lever and Ashby APIs don't return one), slugs that don't match the company name, and stale boards. Only worth it if Slice 11's miss logs show live probing isn't good enough.
