"""
Data access for the `jobs` table - the one place queries for jobs get
written.

Both the Slice 1 loader (writes) and the Slice 3 agent (reads, via a
`get_job` tool) import from here instead of running their own queries -
that's what "shared data-access module" means in CLAUDE.md's architecture
rules: the API and the agent both reach Postgres through modules like this
one, never through each other.
"""

from datetime import datetime

from sqlalchemy import Engine, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from jobsentinel.db.models import Job


# Postgres caps one statement at 65,535 bind parameters. 8 columns per row
# puts the ceiling around 8,000 rows; 1,000 per statement stays well under
# it, and still means a typical board is one or two round-trips, not hundreds.
_UPSERT_CHUNK_SIZE = 1000


def upsert_jobs(engine: Engine, company_id: int, jobs: list[dict]) -> int:
    """Insert one company's normalized job dicts (see
    jobsentinel.ingestion.jobs.job_text.normalized_job), overwriting any
    that already exist by (source, ats_job_id). Returns how many rows were
    written.

    Batched: one multi-row `INSERT ... ON CONFLICT DO UPDATE` per chunk,
    all inside ONE transaction. Compared with a statement + transaction per
    job, that's one commit per company instead of hundreds, and the
    company's jobs land all-or-nothing - a failure halfway through a board
    rolls back cleanly instead of leaving it half-updated.

    `company_id` is passed in rather than looked up per job: the caller
    already has the company row it fetched the board for. The FK on
    jobs.company_id still guarantees it's real.

    Why this isn't a "pure ORM" Session.add()/merge() call: SQLAlchemy's
    ORM has no native atomic upsert. Session.merge() does a SELECT then an
    INSERT-or-UPDATE - not atomic, and it needs the primary key already
    known, which defeats the point since we're deduping on (source,
    ats_job_id), not `id`. Postgres's own `INSERT ... ON CONFLICT DO
    UPDATE` is the correct tool for that, and SQLAlchemy exposes it as an
    Insert statement built directly off the model's table - `Job.__table__`
    is the exact same Core Table object the ORM itself queries against, so
    this isn't a workaround, it's the standard way to do a real upsert even
    in an otherwise fully-ORM codebase.
    """
    # Keyed by ats_job_id so a board listing the same posting twice keeps
    # one copy. Postgres rejects an ON CONFLICT DO UPDATE statement that
    # would touch the same row twice ("command cannot affect row a second
    # time"), which would otherwise fail the whole company.
    rows = {
        job["ats_job_id"]: {
            "ats_job_id": job["ats_job_id"],
            "source": job["source"],
            "board_token": job["board_token"],
            "company_id": company_id,
            "title": job["title"],
            "description": job["description"],
            "url": job["url"],
            "raw_json": job["raw_json"],
            # Arrives as an ISO 8601 string (that's what normalized_job
            # produces); psycopg needs a real datetime for a timestamptz.
            "fetched_at": datetime.fromisoformat(job["fetched_at"]),
        }
        for job in jobs
    }
    if not rows:
        return 0
    rows = list(rows.values())

    with engine.begin() as conn:
        for i in range(0, len(rows), _UPSERT_CHUNK_SIZE):
            stmt = pg_insert(Job.__table__).values(rows[i : i + _UPSERT_CHUNK_SIZE])
            # ON CONFLICT (source, ats_job_id) DO UPDATE - re-running the
            # loader overwrites in place instead of erroring on the unique
            # constraint or duplicating rows. `stmt.excluded` is the row
            # Postgres *tried* to insert, i.e. this run's fresh values.
            stmt = stmt.on_conflict_do_update(
                index_elements=["source", "ats_job_id"],
                set_={
                    col: stmt.excluded[col]
                    for col in ("board_token", "company_id", "title", "description", "url", "raw_json", "fetched_at")
                },
            )
            conn.execute(stmt)
    return len(rows)


def get_job(engine: Engine, job_id: int) -> dict | None:
    """Fetch one job by its internal `id` - NOT its ats_job_id.

    Returns a plain dict, not the live `Job` ORM object, on purpose: the
    object is tied to the Session opened in this function, which is closed
    before we return. Handing back the object itself would risk the
    classic ORM DetachedInstanceError the moment a caller - including the
    agent's `get_job` tool in Slice 3 - touches an attribute after that
    session is gone. A plain dict has no such lifetime to worry about.
    """
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if job is None:
            return None
        return {
            "id": job.id,
            "ats_job_id": job.ats_job_id,
            "source": job.source,
            "board_token": job.board_token,
            "title": job.title,
            "description": job.description,
            "url": job.url,
            "raw_json": job.raw_json,
            "fetched_at": job.fetched_at,
        }


def list_jobs(engine: Engine) -> list[dict]:
    """Every job, ordered by internal id, projected to summary fields only.

    Deliberately excludes `description`/`raw_json` - those are large text
    blobs only needed on the single-job detail view (get_job above), and
    including them here would make a ~600-row response unnecessarily big.

    No pagination or filtering params: today's only loaded board fits
    comfortably in one response as summaries, and positions.py-based
    filtering (or scoping by followed company) is real future job-feed
    work, not something to build ahead of an actual need.
    """
    stmt = select(
        Job.id,
        Job.title,
        Job.source,
        Job.board_token,
        Job.url,
        Job.fetched_at,
    ).order_by(Job.id)
    with Session(engine) as session:
        return [dict(row._mapping) for row in session.execute(stmt)]
