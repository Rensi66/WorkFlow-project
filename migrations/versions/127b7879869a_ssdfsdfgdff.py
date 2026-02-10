"""ssdfsdfgdff

Revision ID: 127b7879869a
Revises: b185ba0e9bb7
Create Date: 2026-02-03 08:44:26.038291

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '127b7879869a'
down_revision: Union[str, Sequence[str], None] = 'b185ba0e9bb7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Явно меняем значение по умолчанию в базе на false
    op.alter_column('users', 'user_is_active', server_default=sa.text('false'))

def downgrade() -> None:
    # Возвращаем как было, если захотим откатиться
    op.alter_column('users', 'user_is_active', server_default=sa.text('true'))
