"""print_jobs.sale_id nullable (suporte a jobs de relatório)

Revision ID: a1f2b3c4d5e6
Revises: 4562173fe3fc
Create Date: 2026-06-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1f2b3c4d5e6'
down_revision: Union[str, None] = '4562173fe3fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('print_jobs', 'sale_id', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    op.alter_column('print_jobs', 'sale_id', existing_type=sa.String(), nullable=False)
