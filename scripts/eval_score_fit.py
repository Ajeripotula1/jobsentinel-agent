"""Slice 4 eval harness (BUILD_PLAN.md): runs the Score Fit agent
(jobsentinel.agent.score_fit.agent) against a fixed set of job fixtures and
prints results side by side, so calibration across postings is something you
can eyeball in one run instead of piecing together from separate one-shot
CLI calls.

Fixtures are keyed by (source, ats_job_id), not internal `jobs.id`: ids
are only stable for as long as a row lives, and a board reload (which
happened once - the original fixture ids all ended up pointing at
unrelated postings) silently re-points them. The ATS's own id doesn't
move. Chosen to span match categories on purpose, not just "jobs that
happen to be loaded" - a harness that only ever sees strong matches can't
tell you whether the agent is properly critical:
  - Anthropic  Senior Software Engineer, Full-stack   - expect: fairly close stack match
  - Anthropic  Software Engineer, Business Technology - expect: weak match, real experience gap
  - Anthropic  Account Executive, AI Native           - expect: not_a_match, different domain entirely -
                                                         the sharpest hallucination test: does the agent invent
                                                         transferable "sales" skills from a SWE profile?
  - Anthropic  Staff+ Software Engineer, Full-stack   - expect: weak/no match on seniority, not skills
  - Anthropic  Forward Deployed Engineer              - expect: ambiguous - ground truth genuinely unclear,
                                                         a posting_underspecified calibration check
  Added in Slice 8 for cross-company/cross-ATS coverage:
  - Cursor (Ashby)  Software Engineer, Generalist     - a ~400-character posting: does the agent say it's
                                                         underspecified instead of inventing requirements?
  - Binance (Lever) Full Stack Engineer (Frontend Oriented) - a Lever description stitched together from
                                                         `lists` sections: is it read as one coherent posting?

Usage:
    uv run python scripts/eval_score_fit.py --user-id user_2abc123
    uv run python scripts/eval_score_fit.py --user-id user_2abc123 --profile-id 14   # pin a specific profile snapshot
"""

import argparse

from sqlalchemy import select

from jobsentinel.agent.score_fit.agent import invoke
from jobsentinel.db.agent_runs import KIND_SCORE_FIT, get_latest_run
from jobsentinel.db.engine import get_engine
from jobsentinel.db.jobs import get_job
from jobsentinel.db.models import Job, ToolCall

FIXTURES = [
    ("greenhouse", "5174743008"),  # Anthropic - Senior Software Engineer, Full-stack
    ("greenhouse", "5400153008"),  # Anthropic - Software Engineer, Business Technology
    ("greenhouse", "4461450008"),  # Anthropic - Account Executive, AI Native
    ("greenhouse", "5174747008"),  # Anthropic - Staff+ Software Engineer, Full-stack
    ("greenhouse", "5391016008"),  # Anthropic - Forward Deployed Engineer
    ("ashby", "36e69353-0452-4bf6-9f35-b1e7307959a7"),  # Cursor - Software Engineer, Generalist
    ("lever", "a90333e6-777f-41fd-9bf5-50f5895ffde3"),  # Binance - Full Stack Engineer (Frontend Oriented)
]


def resolve_job_id(engine, source: str, ats_job_id: str) -> int | None:
    """Today's internal id for a fixture, or None if it's not loaded
    (delisted, or the board hasn't been loaded on this database)."""
    with engine.connect() as conn:
        return conn.execute(
            select(Job.id).where(Job.source == source, Job.ats_job_id == ats_job_id)
        ).scalar_one_or_none()


def get_tool_calls(engine, run_id: int) -> list[dict]:
    """Every tool_calls row for one agent_runs id, oldest first - what
    check_run() below inspects instead of the model's free-text output.
    """
    stmt = (
        select(ToolCall.__table__)
        .where(ToolCall.__table__.c.run_id == run_id)
        .order_by(ToolCall.__table__.c.id.asc())
    )
    with engine.connect() as conn:
        return [dict(row) for row in conn.execute(stmt).mappings().all()]


def check_run(run: dict, tool_calls: list[dict]) -> list[str]:
    """TODO (BUILD_PLAN.md Slice 4 design exercise - write this yourself):
    assert whatever's actually worth checking about `run` (an agent_runs
    row - see jobsentinel.db.agent_runs.get_latest_run for its shape: id,
    job_id, kind, started_at/ended_at, outcome, result, token counts,
    cost_usd) and `tool_calls` (that run's tool_calls rows, oldest first -
    each has tool_name/args/result).

    BUILD_PLAN's starting suggestions: "both tools were called exactly
    once," "no call had empty args." You decide what's worth checking
    beyond that - e.g. does get_job_info's logged result actually match
    this fixture's job_id, did the run's own outcome/result agree with what
    invoke() returned, is cost_usd suspiciously high/None on a success.

    Why tool_calls/agent_runs and not the model's text: free-text output
    varies run to run even when behavior is correct, but what tools got
    called, with what args, and what the DB actually recorded is stable -
    that's the whole reason Slice 3 logs every call in the first place.

    Return a list of human-readable problem strings; an empty list means
    this run passed every check you wrote.
    """
    problems = []

    names = [tc["tool_name"] for tc in tool_calls]
    for expected in ("get_job_info", "get_profile_facts"):
        count = names.count(expected)
        if count != 1:
            problems.append(f"{expected} called {count} time(s), expected exactly 1")

    for tc in tool_calls:
        # get_job_info takes no model-supplied id at all (see build_tools'
        # docstring - job_id is closure-bound), so its logged args should
        # always be empty; a non-empty dict would mean that binding
        # regressed back to a model-suppliable argument. get_profile_facts
        # logs its bound profile_id too, but that's recording *which config
        # was used*, not something the model supplied - not checked here.
        if tc["tool_name"] == "get_job_info" and tc["args"]:
            problems.append(f"get_job_info called with unexpected args {tc['args']!r}")
        if tc["tool_name"] in ("get_job_info", "get_profile_facts") and "error" in tc["result"]:
            problems.append(f"{tc['tool_name']} returned an error: {tc['result']['error']}")

    if run.get("outcome") != "success":
        problems.append(f"run outcome was {run.get('outcome')!r}, not 'success'")
    if run.get("result") is None:
        problems.append("run has no stored result despite finishing")
    if run.get("cost_usd") is None:
        problems.append("run has no cost_usd recorded")

    return problems


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--user-id", required=True, help="Clerk user ID to score/own the profile lookup as"
    )
    parser.add_argument(
        "--profile-id",
        type=int,
        default=None,
        help="score against this profile snapshot instead of the latest submission",
    )
    args = parser.parse_args()

    engine = get_engine()
    results = []

    for source, ats_job_id in FIXTURES:
        job_id = resolve_job_id(engine, source, ats_job_id)
        if job_id is None:
            print(f"skipping {source}/{ats_job_id}: not loaded on this database")
            continue
        job = get_job(engine, job_id)
        title = f"{job['company']} - {job['title']}"
        print(f"scoring [{job_id}] {title!r}...")

        payload = {"job_id": job_id, "user_id": args.user_id}
        if args.profile_id is not None:
            payload["profile_id"] = args.profile_id
        assessment = invoke(payload)

        run = get_latest_run(engine, job_id, kind=KIND_SCORE_FIT)
        tool_calls = get_tool_calls(engine, run["id"]) if run else []
        results.append(
            {"job_id": job_id, "title": title, "assessment": assessment, "run": run, "tool_calls": tool_calls}
        )

    print("\n" + "=" * 100)
    print(f"{'job':>6}  {'match':<20}  title")
    print("=" * 100)
    for r in results:
        match = r["assessment"].get("match", f"ERROR: {r['assessment'].get('error')}")
        print(f"{r['job_id']:>6}  {match:<20}  {r['title']}")

    # Full strengths/gaps, not just the match category - this is the raw
    # material for BUILD_PLAN's "manually review several runs for
    # hallucination" step: read each requirement/evidence pair against the
    # actual job text and profile facts (jobsentinel.agent.score_fit.agent's
    # get_job_info/get_profile_facts tool_calls rows below have both, if you
    # want them without a separate DB query) and check the evidence is
    # really there, not a plausible-sounding paraphrase.
    print("\n--- per-job detail (for manual hallucination review) ---\n")
    for r in results:
        print(f"[{r['job_id']}] {r['title']}")
        assessment = r["assessment"]
        if "error" in assessment:
            print(f"  ERROR: {assessment['error']}\n")
            continue
        print(f"  match: {assessment['match']}")
        print(f"  summary: {assessment['summary']}")
        print(f"  recommendation_note: {assessment['recommendation_note']}")
        print("  strengths:")
        for s in assessment["strengths"]:
            print(f"    - requirement: {s['requirement']}")
            print(f"      evidence:    {s['evidence']}")
        print("  gaps:")
        for g in assessment["gaps"]:
            note = f" ({g['note']})" if g.get("note") else ""
            print(f"    - [{g['gap_type']}] {g['requirement']}{note}")
        print()

    print("--- tool_calls / agent_runs assertions (Slice 4 design exercise) ---\n")
    for r in results:
        if r["run"] is None:
            print(f"[{r['job_id']}] no run recorded - skipping check_run")
            continue
        try:
            problems = check_run(r["run"], r["tool_calls"])
        except NotImplementedError:
            print("check_run() isn't implemented yet - see its docstring above main()")
            break
        status = "OK" if not problems else "PROBLEMS: " + "; ".join(problems)
        print(f"[{r['job_id']}] {status}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
