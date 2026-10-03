"""Greenhouse adapter: fetch a company's public board, return normalized jobs.

The board token is the slug in a company's public board URL - e.g. for
boards.greenhouse.io/anthropic the token is "anthropic".
"""

import logging

from jobsentinel.ingestion.jobs.http import get_board_json
from jobsentinel.ingestion.jobs.job_text import html_to_text, normalized_job

logger = logging.getLogger(__name__)

# Greenhouse's board endpoint returns every posting in one response - unlike
# some ATS APIs, there's no pagination to worry about here. `content=true`
# includes the full HTML job description, which is what we turn into `description`.
GREENHOUSE_BOARD_URL = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs"


def fetch_jobs(board_token: str) -> list[dict]:
    """Fetch every posting on a company's Greenhouse board, normalized."""
    data = get_board_json(GREENHOUSE_BOARD_URL.format(token=board_token), params={"content": "true"})

    jobs = []
    for job in data.get("jobs", []):
        content = job.get("content")
        if not content:
            # No description means nothing for the agent to ground on later - skip it.
            logger.warning("greenhouse/%s: skipping %s, no description", board_token, job.get("id"))
            continue
        jobs.append(
            normalized_job(
                ats_job_id=job["id"],
                source="greenhouse",
                board_token=board_token,
                title=job["title"],
                description=html_to_text(content),
                url=job.get("absolute_url"),
                raw=job,
            )
        )
    return jobs
