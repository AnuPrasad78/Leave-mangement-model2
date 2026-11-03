"""add admin persona tables

Revision ID: f7b21d94c05e
Revises: 33896ade47f9
Create Date: 2026-10-28

Admin-persona support: append-only audit trail, password reset tokens,
DB-backed notifications, and the new annual-cap default for future balance rows
(existing rows carry their stored cap; see ADMIN_DECISIONS.md Q2d).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f7b21d94c05e'
down_revision: Union[str, Sequence[str], None] = '33896ade47f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('audit_logs',
    sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
    sa.Column('actor_user_id', sa.Uuid(as_uuid=False), nullable=True),
    sa.Column('actor_employee_id', sa.Uuid(as_uuid=False), nullable=True),
    sa.Column('action', sa.Text(), nullable=False),
    sa.Column('target_type', sa.Text(), nullable=False),
    sa.Column('target_id', sa.Text(), nullable=True),
    sa.Column('detail_json', postgresql.JSONB(), nullable=True),
    sa.Column('request_ip', postgresql.INET(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['actor_employee_id'], ['employees.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('audit_logs_action_idx', 'audit_logs', ['action'], unique=False)
    op.create_index('audit_logs_actor_user_id_idx', 'audit_logs', ['actor_user_id'], unique=False)
    op.create_index('audit_logs_created_at_idx', 'audit_logs', ['created_at'], unique=False)
    op.create_table('password_reset_tokens',
    sa.Column('id', sa.Uuid(as_uuid=False), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.Uuid(as_uuid=False), nullable=False),
    sa.Column('token_hash', sa.Text(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by', sa.Uuid(as_uuid=False), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index('password_reset_tokens_user_expiry_idx', 'password_reset_tokens', ['user_id', 'expires_at'], unique=False)
    op.create_table('notifications',
    sa.Column('id', sa.BigInteger(), sa.Identity(always=True), nullable=False),
    sa.Column('recipient_employee_id', sa.Uuid(as_uuid=False), nullable=False),
    sa.Column('kind', sa.Text(), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('target_type', sa.Text(), nullable=True),
    sa.Column('target_id', sa.Text(), nullable=True),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['recipient_employee_id'], ['employees.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('notifications_recipient_idx', 'notifications', ['recipient_employee_id', 'created_at'], unique=False)
    op.alter_column('leave_balances', 'annual_cap',
        server_default=sa.text('22'),
        existing_type=sa.Numeric(precision=5, scale=2),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('leave_balances', 'annual_cap',
        server_default=sa.text('18'),
        existing_type=sa.Numeric(precision=5, scale=2),
        existing_nullable=False,
    )
    op.drop_index('notifications_recipient_idx', table_name='notifications')
    op.drop_table('notifications')
    op.drop_index('password_reset_tokens_user_expiry_idx', table_name='password_reset_tokens')
    op.drop_table('password_reset_tokens')
    op.drop_index('audit_logs_action_idx', table_name='audit_logs')
    op.drop_index('audit_logs_actor_user_id_idx', table_name='audit_logs')
    op.drop_index('audit_logs_created_at_idx', table_name='audit_logs')
    op.drop_table('audit_logs')
