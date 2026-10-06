"""
Data access for the `jobs` table - the one place queries for jobs get
written.

Both the Slice 1 loader (writes) and the Slice 3 agent (reads, via a
`get_job` tool) import from here instead of running their own queries -
that's what "shared data-access module" means in CLAUDE.md's architecture
rules: the API and the agent both reach Postgres through modules like this
one, never through each other.
"""

from sqlalchemy import Engine, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from jobsentinel.db.models import Company, Job


# Postgres caps one statement at 65,535 bind parameters. 13 columns per row
# puts the ceiling around 5,000 rows; 1,000 per statement stays well under
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
            "posted_at": job["posted_at"],
            "location": job["location"],
            "workplace_type": job["workplace_type"],
            "last_synced_at": job["last_synced_at"],
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
                    for col in (
                        "board_token", "company_id", "title", "description", "url", "raw_json",
                        "posted_at", "location", "workplace_type", "last_synced_at",
                    )
                },
            )
            conn.execute(stmt)
    return len(rows)


# Columns every job read returns. `company` comes from a join, not from
# jobs itself - board_token is an ATS slug ("shieldai"), not a display name.
_SUMMARY_COLUMNS = (
    Job.id,
    Job.title,
    Job.source,
    Job.company_id,
    Company.name.label("company"),
    Job.url,
    Job.posted_at,
    Job.location,
    Job.workplace_type,
    Job.last_synced_at,
)


def get_job(engine: Engine, job_id: int) -> dict | None:
    """Fetch one job by its internal `id` - NOT its ats_job_id - joined to
    its company's display name.

    Returns a plain dict, not a live `Job` ORM object, on purpose: an ORM
    object is tied to the Session it was loaded in, which is closed before
    we return. Handing it back would risk the classic DetachedInstanceError
    the moment a caller - including the agents' `get_job_info` tools -
    touches an attribute after that session is gone. A plain row mapping
    has no such lifetime to worry about.
    """
    stmt = (
        select(*_SUMMARY_COLUMNS, Job.ats_job_id, Job.board_token, Job.description, Job.raw_json)
        .join(Company, Job.company_id == Company.id)
        .where(Job.id == job_id)
    )
    with Session(engine) as session:
        row = session.execute(stmt).one_or_none()
        return dict(row._mapping) if row else None


def list_jobs(engine: Engine) -> list[dict]:
    """Every job, newest posting first, projected to summary fields only.

    Deliberately excludes `description`/`raw_json` - those are large text
    blobs only needed on the single-job detail view (get_job above), and
    including them here would make a ~7,000-row response many MB.

    One query with a join for the company name, not a lookup per job.
    NULLS LAST so postings without a publish date sink to the bottom
    instead of Postgres's default (NULLs first under DESC); `id` breaks
    ties so the order is stable between requests.

    No pagination or filtering params yet - per BUILD_PLAN Slice 8 the
    row count is now big enough that this is Slice 9's job (a per-user,
    server-filtered feed), not something to bolt on here.
    """
    stmt = (
        select(*_SUMMARY_COLUMNS)
        .join(Company, Job.company_id == Company.id)
        .order_by(Job.posted_at.desc().nulls_last(), Job.id)
    )
    with Session(engine) as session:
        return [dict(row._mapping) for row in session.execute(stmt)]
