"""Pull a company's public Lever postings and produce normalized,
LLM/human-readable job postings.

Lever is the hard case of the three. Two structural quirks:
  - the endpoint returns a bare JSON array, not a dict with a "jobs" key
  - the description is fragmented: `descriptionPlain` is only the intro,
    and the actual requirements/skills live in `lists` - an array of
    {text: heading, content: HTML} sections (e.g. "What you'll do",
    "What you need"). Joining descriptionPlain with each list's cleaned
    content is what makes the result usable.

The company slug is what appears in jobs.lever.co/<company>.
"""

import logging
from datetime import datetime, timezone

from jobsentinel.ingestion.jobs.http import get_board_json
from jobsentinel.ingestion.jobs.job_text import html_to_text, normalized_job

logger = logging.getLogger(__name__)

LEVER_POSTINGS_URL = "https://api.lever.co/v0/postings/{company}?mode=json"


def _combine_description(job: dict) -> str:
    """Join Lever's intro text with each `lists` section into one block.

    Each list item is {"text": <heading>, "content": <HTML>} - the heading
    is kept as a label so requirements/skills sections stay identifiable
    instead of blurring into one undifferentiated paragraph.
    """
    parts = []

    intro = job.get("descriptionPlain")
    if intro:
        parts.append(intro)

    for section in job.get("lists", []):
        heading = (section.get("text") or "").strip()
        body = html_to_text(section.get("content"))
        if not body:
            continue
        parts.append(f"{heading}:\n{body}" if heading else body)

    additional = job.get("additionalPlain")
    if additional:
        parts.append(additional)

    return "\n\n".join(parts)


def fetch_jobs(company: str) -> list[dict]:
    """Fetch every posting for a company on Lever, normalized."""
    data = get_board_json(LEVER_POSTINGS_URL.format(company=company))

    jobs = []
    for job in data:
        # Already Markdown (each `lists` section went through html_to_text
        # in _combine_description) - it must not go through html_to_text a
        # second time, which would escape the Markdown's own `*`/`_`.
        description = _combine_description(job)
        if not description:
            logger.warning("lever/%s: skipping %s, no description", company, job.get("id"))
            continue
        jobs.append(
            normalized_job(
                ats_job_id=job["id"],
                source="lever",
                board_token=company,
                # Lever's title field is "text", not "title".
                title=job.get("text", ""),
                description=description,
                url=job.get("hostedUrl"),
                # Epoch milliseconds, not an ISO string.
                posted_at=datetime.fromtimestamp(job["createdAt"] / 1000, tz=timezone.utc) if job.get("createdAt") else None,
                location=_location(job),
                workplace_type=job.get("workplaceType"),
                raw=job,
            )
        )
    return jobs


def _location(job: dict) -> str | None:
    categories = job.get("categories") or {}
    names = categories.get("allLocations") or [categories.get("location")]
    return "; ".join(n for n in names if n) or None
