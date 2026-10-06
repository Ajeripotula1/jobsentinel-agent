"""jobs posted_at location workplace_type, rename fetched_at

Revision ID: 00f1e70971b1
Revises: 7236dc6bf4c1
Create Date: 2026-10-02 18:59:28.023791

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '00f1e70971b1'
down_revision: Union[str, Sequence[str], None] = '7236dc6bf4c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    Hand-edited: autogenerate rendered the fetched_at -> last_synced_at
    rename as add_column(last_synced_at, NOT NULL) + drop_column(fetched_at).
    That would fail on existing rows, and if it didn't, it would throw away
    every timestamp. Autogenerate can't tell a rename from a drop + add -
    it only diffs names - so renames always need this by hand.

    The three new columns are nullable and not backfilled here: re-running
    `python -m jobsentinel.ingestion.jobs.load_jobs` fills them from each
    ATS's payload, using the same adapter code that handles new postings,
    rather than re-implementing that extraction a second time in SQL.
    """
    op.alter_column('jobs', 'fetched_at', new_column_name='last_synced_at')
    op.add_column('jobs', sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('jobs', sa.Column('location', sa.Text(), nullable=True))
    op.add_column('jobs', sa.Column('workplace_type', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('jobs', 'workplace_type')
    op.drop_column('jobs', 'location')
    op.drop_column('jobs', 'posted_at')
    op.alter_column('jobs', 'last_synced_at', new_column_name='fetched_at')
