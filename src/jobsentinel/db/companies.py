"""
Data access for the `companies` table - the followed-companies list that
the poller iterates over, and that every `jobs` row points at via
jobs.company_id.

Same conventions as jobsentinel.db.jobs: callers pass in an Engine, and get
back plain dicts (or ids), never live ORM objects.
"""

from sqlalchemy import Engine, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from jobsentinel.db.models import Company


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
