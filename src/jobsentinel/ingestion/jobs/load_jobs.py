"""Fetch every company in the `companies` table from its ATS and upsert its
jobs into Postgres.

Re-running is safe: jobs are upserted by (source, ats_job_id), so existing
rows are overwritten in place. One company failing (bad board_token,
timeout, ATS outage) is logged and skipped - it never aborts the rest of
the run. That per-company isolation is the shape Stage 4's poller keeps.

Usage:
    uv run python -m jobsentinel.ingestion.jobs.load_jobs
"""

import logging
from collections.abc import Callable

import requests

from jobsentinel.db.companies import list_companies
from jobsentinel.db.engine import get_engine
from jobsentinel.db.jobs import upsert_jobs
from jobsentinel.ingestion.jobs import ashby_api, greenhouse_api, lever_api
from jobsentinel.ingestion.jobs.http import BoardNotFound

logger = logging.getLogger(__name__)

# companies.source -> that ATS's adapter. Every adapter has the same
# signature, so adding a fourth ATS is one new module + one line here, and
# the loop below never changes.
FETCHERS: dict[str, Callable[[str], list[dict]]] = {
    "greenhouse": greenhouse_api.fetch_jobs,
    "ashby": ashby_api.fetch_jobs,
    "lever": lever_api.fetch_jobs,
}


def load_company(engine, company: dict) -> int:
    """Fetch one company's board and upsert it. Returns jobs written."""
    fetch = FETCHERS.get(company["source"])
    if fetch is None:
        raise ValueError(f"no adapter for source {company['source']!r}")
    jobs = fetch(company["board_token"])
    return upsert_jobs(engine, company["id"], jobs)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    engine = get_engine()
    companies = list_companies(engine)

    total = 0
    failed = []
    # One company at a time: fetch, write, move on. Only one board's
    # postings are held in memory at once, and each company commits on its
    # own, so a late failure doesn't throw away earlier companies' work.
    for company in companies:
        label = f"{company['name']} ({company['source']}/{company['board_token']})"
        try:
            count = load_company(engine, company)
        except (BoardNotFound, requests.RequestException) as exc:
            # Expected, external failures (404, timeout, 5xx): the message
            # says it all, a traceback would just be noise.
            logger.error("%s: fetch failed: %s", label, exc)
            failed.append(label)
            continue
        except Exception:
            # Anything else is likely a bug (e.g. an ATS changed its payload
            # shape -> KeyError) - keep the traceback.
            logger.exception("%s: failed", label)
            failed.append(label)
            continue
        total += count
        logger.info("%s: %d jobs", label, count)

    logger.info(
        "done: %d jobs from %d/%d companies", total, len(companies) - len(failed), len(companies)
    )
    if failed:
        logger.warning("failed: %s", ", ".join(failed))
    # Non-zero exit when anything failed, so a scheduler/CI can notice.
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
