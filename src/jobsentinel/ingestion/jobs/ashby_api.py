"""Ashby adapter: fetch a company's public board, return normalized jobs.

Ashby is the easy case of the three: the full posting (intro + requirements
+ skills) is in one field. It ships both `descriptionHtml` and
`descriptionPlain` - the HTML one is used so it goes through the same
html_to_text -> Markdown path as Greenhouse. Running markdownify over the
plain-text field instead would escape every `*` and `_` in it.

The board token is the slug in a company's public board URL - e.g. for
jobs.ashbyhq.com/ramp the token is "ramp".
"""

import logging
from datetime import datetime

from jobsentinel.ingestion.jobs.http import get_board_json
from jobsentinel.ingestion.jobs.job_text import html_to_text, normalized_job

logger = logging.getLogger(__name__)

ASHBY_BOARD_URL = "https://api.ashbyhq.com/posting-api/job-board/{token}"


def fetch_jobs(board_token: str) -> list[dict]:
    """Fetch every posting on a company's Ashby job board, normalized."""
    data = get_board_json(ASHBY_BOARD_URL.format(token=board_token))

    jobs = []
    for job in data.get("jobs", []):
        description = job.get("descriptionHtml")
        if not description:
            logger.warning("ashby/%s: skipping %s, no description", board_token, job.get("id"))
            continue
        jobs.append(
            normalized_job(
                ats_job_id=job["id"],
                source="ashby",
                board_token=board_token,
                title=job["title"],
                description=html_to_text(description),
                url=job.get("jobUrl"),
                posted_at=datetime.fromisoformat(job["publishedAt"]) if job.get("publishedAt") else None,
                location=_location(job),
                workplace_type=job.get("workplaceType"),
                raw=job,
            )
        )
    return jobs


def _location(job: dict) -> str | None:
    """Primary location plus any secondaries, e.g.
    "New York, NY (HQ); Remote (US); Miami, FL"."""
    names = [job.get("location")] + [loc.get("location") for loc in job.get("secondaryLocations") or []]
    return "; ".join(n for n in names if n) or None
