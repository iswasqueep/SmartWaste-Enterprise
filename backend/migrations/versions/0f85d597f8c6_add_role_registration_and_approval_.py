"""Add role registration and approval profiles.

Revision ID: 0f85d597f8c6
Revises: 4639c2678d59
Create Date: 2026-07-17 15:09:26.503700
"""

from alembic import op
import sqlalchemy as sa


# Revision identifiers used by Alembic.
revision = "0f85d597f8c6"
down_revision = "4639c2678d59"
branch_labels = None
depends_on = None


# Explicit names make both upgrade and downgrade reliable.
COLLECTOR_IDENTIFICATION_UQ = (
    "uq_collector_profiles_identification_number"
)

USERS_APPROVAL_STATUS_INDEX = (
    "ix_users_approval_status"
)


def upgrade():
    """Apply role registration and approval profile changes."""

    # ---------------------------------------------------------
    # 1. Create government profile table
    # ---------------------------------------------------------
    op.create_table(
        "government_profiles",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "agency_name",
            sa.String(length=180),
            nullable=False,
        ),
        sa.Column(
            "department",
            sa.String(length=150),
            nullable=True,
        ),
        sa.Column(
            "official_id",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_government_profiles_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="pk_government_profiles",
        ),
        sa.UniqueConstraint(
            "official_id",
            name="uq_government_profiles_official_id",
        ),
        sa.UniqueConstraint(
            "user_id",
            name="uq_government_profiles_user_id",
        ),
    )

    # ---------------------------------------------------------
    # 2. Create recycling company profile table
    # ---------------------------------------------------------
    op.create_table(
        "recycling_company_profiles",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "company_name",
            sa.String(length=180),
            nullable=False,
        ),
        sa.Column(
            "registration_number",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "business_address",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "accepted_waste_types",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_recycling_company_profiles_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="pk_recycling_company_profiles",
        ),
        sa.UniqueConstraint(
            "registration_number",
            name=(
                "uq_recycling_company_profiles_"
                "registration_number"
            ),
        ),
        sa.UniqueConstraint(
            "user_id",
            name="uq_recycling_company_profiles_user_id",
        ),
    )

    # ---------------------------------------------------------
    # 3. Add collector fields as nullable first
    # ---------------------------------------------------------
    with op.batch_alter_table(
        "collector_profiles",
        schema=None,
    ) as batch_op:
        batch_op.add_column(
            sa.Column(
                "identification_number",
                sa.String(length=100),
                nullable=True,
            )
        )

        batch_op.add_column(
            sa.Column(
                "operating_area",
                sa.String(length=150),
                nullable=True,
            )
        )

    # ---------------------------------------------------------
    # 4. Populate existing collector records
    # ---------------------------------------------------------
    op.execute(
        sa.text(
            """
            UPDATE collector_profiles
            SET identification_number =
                'LEGACY-COLLECTOR-' || id::text
            WHERE identification_number IS NULL
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE collector_profiles
            SET operating_area = 'Unspecified'
            WHERE operating_area IS NULL
            """
        )
    )

    # ---------------------------------------------------------
    # 5. Make collector fields mandatory and unique
    # ---------------------------------------------------------
    with op.batch_alter_table(
        "collector_profiles",
        schema=None,
    ) as batch_op:
        batch_op.alter_column(
            "identification_number",
            existing_type=sa.String(length=100),
            nullable=False,
        )

        batch_op.alter_column(
            "operating_area",
            existing_type=sa.String(length=150),
            nullable=False,
        )

        batch_op.create_unique_constraint(
            COLLECTOR_IDENTIFICATION_UQ,
            ["identification_number"],
        )

    # ---------------------------------------------------------
    # 6. Add approval_status as nullable first
    # ---------------------------------------------------------
    with op.batch_alter_table(
        "users",
        schema=None,
    ) as batch_op:
        batch_op.add_column(
            sa.Column(
                "approval_status",
                sa.String(length=30),
                nullable=True,
            )
        )

    # Existing accounts should remain usable.
    op.execute(
        sa.text(
            """
            UPDATE users
            SET approval_status = 'approved'
            WHERE approval_status IS NULL
            """
        )
    )

    # ---------------------------------------------------------
    # 7. Make approval_status mandatory and indexed
    # ---------------------------------------------------------
    with op.batch_alter_table(
        "users",
        schema=None,
    ) as batch_op:
        batch_op.alter_column(
            "approval_status",
            existing_type=sa.String(length=30),
            nullable=False,
            server_default="approved",
        )

        batch_op.create_index(
            USERS_APPROVAL_STATUS_INDEX,
            ["approval_status"],
            unique=False,
        )

    # Remove the database-level default after existing data
    # has been migrated. New values should come from the app.
    with op.batch_alter_table(
        "users",
        schema=None,
    ) as batch_op:
        batch_op.alter_column(
            "approval_status",
            existing_type=sa.String(length=30),
            nullable=False,
            server_default=None,
        )


def downgrade():
    """Reverse role registration and approval profile changes."""

    # ---------------------------------------------------------
    # 1. Remove approval status
    # ---------------------------------------------------------
    with op.batch_alter_table(
        "users",
        schema=None,
    ) as batch_op:
        batch_op.drop_index(
            USERS_APPROVAL_STATUS_INDEX,
        )

        batch_op.drop_column(
            "approval_status",
        )

    # ---------------------------------------------------------
    # 2. Remove collector profile additions
    # ---------------------------------------------------------
    with op.batch_alter_table(
        "collector_profiles",
        schema=None,
    ) as batch_op:
        batch_op.drop_constraint(
            COLLECTOR_IDENTIFICATION_UQ,
            type_="unique",
        )

        batch_op.drop_column(
            "operating_area",
        )

        batch_op.drop_column(
            "identification_number",
        )

    # ---------------------------------------------------------
    # 3. Remove the new profile tables
    # ---------------------------------------------------------
    op.drop_table(
        "recycling_company_profiles",
    )

    op.drop_table(
        "government_profiles",
    )