"""order_status

Revision ID: 6408a4482d24
Revises: 000
Create Date: 2025-07-12 10:11:35.715568

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, Sequence[str], None] = '000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add 'placed' value to order_status enum
    op.execute("ALTER TYPE order_status ADD VALUE 'placed' AFTER 'processing'")


def downgrade() -> None:
    """Downgrade schema."""
    # Note: PostgreSQL doesn't support removing enum values directly
    # To downgrade, you would need to recreate the enum without 'placed'
    # and update all references, which is complex and risky.
    # For now, we'll leave the enum value in place.
    pass
