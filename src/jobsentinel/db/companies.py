"""
Data access for the `companies` table - the followed-companies list that
the poller iterates over, and that every `jobs` row points at via
jobs.company_id.

Same conventions as jobsentinel.db.jobs: callers pass in an Engine, and get
back plain dicts (or ids), never live ORM objects.
"""

from sqlalchemy import Engine, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from jobsentinel.db.models import Company, Job


def upsert_company(engine: Engine, name: str, source: str, board_token: str) -> int:
    """Insert a company, or update its `name` in place if (source,
    board_token) already exists. Returns the row's `id` either way.

    An upsert rather than a plain insert so the seed script is safe to
    re-run: each run converges the table to whatever the CSV says instead
    of erroring on uq_companies_source_board_token. Updating `name` on
    conflict is also what replaces the placeholder names the
    7236dc6bf4c1 migration backfilled (it used board_token as the name,
    since jobs rows don't carry one).

    (source, board_token) is the natural key - it's what identifies a board
    on an ATS, and it's how the loader matches a board to its company.
    """
    stmt = pg_insert(Company.__table__).values(
        name=name,
        source=source,
        board_token=board_token,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["source", "board_token"],
        set_={"name": stmt.excluded.name},
    ).returning(Company.__table__.c.id)

    with engine.begin() as conn:
        return conn.execute(stmt).scalar_one()


def get_company(engine: Engine, source: str, board_token: str) -> dict | None:
    """Fetch one company by its (source, board_token) natural key, or None
    if that board isn't followed."""
    stmt = select(Company).where(
        Company.source == source,
        Company.board_token == board_token,
    )
    with Session(engine) as session:
        company = session.scalars(stmt).one_or_none()
        if company is None:
            return None
        return _to_dict(company)


def list_companies(engine: Engine) -> list[dict]:
    """Every followed company, ordered by id - what the poller will loop
    over to know which boards to fetch."""
    stmt = select(Company).order_by(Company.id)
    with Session(engine) as session:
        return [_to_dict(c) for c in session.scalars(stmt)]


def list_companies_with_job_counts(engine: Engine) -> list[dict]:
    """Every company plus how many jobs it has loaded (`job_count`),
    ordered by id - what GET /companies returns for the Companies page.

    Counted live on every call rather than stored in a `companies.job_count`
    column: a stored counter is a second copy of a fact that can drift from
    `jobs` (a loader crash mid-board, a manual delete, delisting logic that
    forgets to decrement). Counting from the source can't go stale, and at
    ~20 companies / ~7k jobs it's milliseconds - denormalize only once a
    measurement says this is slow.

    Separate from list_companies() because the poller/seed script don't
    need the aggregate, so they shouldn't pay for the join.

    Three details that make the count right:
    - OUTER join, not inner: a company with zero jobs (just seeded, board
      not loaded yet) would vanish from an inner join. Outer keeps it.
    - count(Job.id), not count(*): for a zero-job company the outer join
      yields one row with every jobs column NULL. count(*) counts that row
      (-> 1); count(Job.id) skips NULLs (-> 0).
    - GROUP BY Company.id alone is enough: it's the primary key, so
      Postgres knows the other companies columns are determined by it.

    Slice 10 note: once delisting marks jobs closed, the "open jobs only"
    condition belongs in the JOIN's ON clause, not a WHERE - filtering
    jobs columns in WHERE discards the NULL rows and silently turns this
    back into an inner join.
    """
    stmt = (
        select(
            Company.id,
            Company.name,
            Company.source,
            Company.board_token,
            func.count(Job.id).label("job_count"),
        )
        .outerjoin(Job, Job.company_id == Company.id)
        .group_by(Company.id)
        .order_by(Company.id)
    )
    with Session(engine) as session:
        return [dict(row._mapping) for row in session.execute(stmt)]


def _to_dict(company: Company) -> dict:
    # Built while the Session is still open - see get_job in
    # jobsentinel.db.jobs for why plain dicts instead of ORM objects.
    return {
        "id": company.id,
        "name": company.name,
        "source": company.source,
        "board_token": company.board_token,
        "created_at": company.created_at,
    }
