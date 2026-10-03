"""added company_id FK to job table

Revision ID: 7236dc6bf4c1
Revises: e8ce31d65b79
Create Date: 2026-10-02 12:34:53.034399

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7236dc6bf4c1'
down_revision: Union[str, Sequence[str], None] = 'e8ce31d65b79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Hand-edited from the autogenerate draft, which did a single
    add_column(nullable=False) - that fails on a `jobs` table that already
    has rows, since Postgres has nothing to put in the new column for them.
    Instead this is the standard expand -> backfill -> contract sequence,
    all inside one transaction (Postgres has transactional DDL):
    """
    # 1. Expand: add the column as nullable so existing rows are allowed.
    op.add_column('jobs', sa.Column('company_id', sa.Integer(), nullable=True))

    # 2a. Make sure every (source, board_token) already in `jobs` has a
    # matching `companies` row, so `upgrade head` works on any database
    # without depending on a seed script having run first. `name` is NOT
    # NULL but jobs don't carry a company name, so board_token stands in as
    # a placeholder (re-seeding can overwrite it later). ON CONFLICT DO
    # NOTHING leaves already-seeded companies untouched.
    op.execute(
        """
        INSERT INTO companies (name, source, board_token)
        SELECT DISTINCT board_token, source, board_token FROM jobs
        ON CONFLICT (source, board_token) DO NOTHING
        """
    )
    # 2b. Backfill: point every job at its company via the shared
    # (source, board_token) natural key.
    op.execute(
        """
        UPDATE jobs SET company_id = c.id
        FROM companies c
        WHERE c.source = jobs.source AND c.board_token = jobs.board_token
        """
    )

    # 3. Contract: every row now has a value, so NOT NULL can be enforced.
    op.alter_column('jobs', 'company_id', nullable=False)

    # Named explicitly - autogenerate rendered create_foreign_key(None, ...),
    # which downgrade() can't reference (same issue as 7c1bad1c0719).
    op.create_foreign_key(
        'fk_jobs_company_id_companies', 'jobs', 'companies', ['company_id'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema.

    Companies inserted by upgrade() are intentionally left in place - they
    can't be told apart from seeded ones, and dropping the companies table
    itself is the previous migration's job.
    """
    op.drop_constraint('fk_jobs_company_id_companies', 'jobs', type_='foreignkey')
    op.drop_column('jobs', 'company_id')
