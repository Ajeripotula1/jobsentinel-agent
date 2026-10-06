"""
Data access for the `user_companies` table - which companies each user
follows. One row per (user_id, company_id); see UserCompany in
jobsentinel.db.models for why it's a junction table and not an array.

Same conventions as jobsentinel.db.jobs / jobsentinel.db.companies: callers
pass in an Engine, and get back plain values/dicts, never live ORM objects.

`user_id` is always the Clerk user ID (JWT `sub`) the API resolved from the
request - these functions trust it and never take it from a request body,
so one user can never follow/unfollow on another's behalf.
"""

from sqlalchemy import Engine, delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from jobsentinel.db.models import Company, UserCompany


def follow_company(engine: Engine, user_id: str, company_id: int) -> bool:
    """Make `user_id` follow `company_id`. Returns True if this created a
    new follow, False if they already followed it.

    Idempotent via `INSERT ... ON CONFLICT DO NOTHING`: a double-clicked
    Follow button or a retried request is a no-op instead of a
    primary-key violation. That's also why this isn't "SELECT to check,
    then INSERT" - two concurrent requests could both pass the check and
    one would then blow up on the PK. Letting Postgres resolve the conflict
    atomically has no such race.

    No ON CONFLICT target is given, so it covers any unique violation - the
    composite PK (user_id, company_id) is the only one on this table.

    A `company_id` that doesn't exist is NOT swallowed: the FK raises
    sqlalchemy.exc.IntegrityError, which the API layer should turn into a
    404 rather than this function guessing at HTTP semantics.
    """
    stmt = (
        pg_insert(UserCompany.__table__)
        .values(user_id=user_id, company_id=company_id)
        .on_conflict_do_nothing()
        # RETURNING hands back the inserted row, or nothing if the conflict
        # skipped it - that's how we tell "new follow" from "already
        # following". Not `.rowcount`: SQLAlchemy reports -1 ("unknown")
        # for this INSERT on psycopg, so `rowcount == 1` is always False.
        .returning(UserCompany.__table__.c.company_id)
    )
    with engine.begin() as conn:
        return conn.execute(stmt).scalar_one_or_none() is not None


def unfollow_company(engine: Engine, user_id: str, company_id: int) -> bool:
    """Stop `user_id` following `company_id`. Returns True if a follow was
    removed, False if they weren't following it.

    Also idempotent: unfollowing something you don't follow just deletes
    zero rows. The `user_id` filter is what scopes this to the caller's own
    follow - deleting by company_id alone would unfollow it for everyone.
    """
    stmt = delete(UserCompany).where(
        UserCompany.user_id == user_id,
        UserCompany.company_id == company_id,
    )
    with engine.begin() as conn:
        return conn.execute(stmt).rowcount == 1


def list_followed_companies(engine: Engine, user_id: str) -> list[dict]:
    """Every company `user_id` follows, joined to its details, ordered by
    company name - what a "your companies" view renders.

    One query with a join, not "fetch ids, then look up each company".
    `followed_at` is the follow's own created_at, distinct from the
    company row's created_at (when it was seeded).

    Uses the PK index: user_id is its leading column, so this is an index
    lookup, not a scan of every user's follows.
    """
    stmt = (
        select(
            Company.id,
            Company.name,
            Company.source,
            Company.board_token,
            UserCompany.created_at.label("followed_at"),
        )
        .join(UserCompany, UserCompany.company_id == Company.id)
        .where(UserCompany.user_id == user_id)
        .order_by(Company.name, Company.id)
    )
    with Session(engine) as session:
        return [dict(row._mapping) for row in session.execute(stmt)]


def list_followed_company_ids(engine: Engine, user_id: str) -> set[int]:
    """Just the ids of the companies `user_id` follows.

    For callers that only need membership, not details - e.g. marking a
    Follow/Following toggle on each row of the full companies list
    (`company["id"] in followed`) without a second joined query. A set,
    because membership checks are the whole point.
    """
    stmt = select(UserCompany.company_id).where(UserCompany.user_id == user_id)
    with Session(engine) as session:
        return set(session.scalars(stmt))
