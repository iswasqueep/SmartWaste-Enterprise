from pathlib import Path
import shutil
from datetime import datetime

root = Path.cwd()
path = root / "backend" / "app" / "routes" / "admin.py"

if not path.exists():
    raise SystemExit(f"File not found: {path}")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = path.with_suffix(path.suffix + f".backup_{stamp}")
shutil.copy2(path, backup)
print(f"Backup created: {backup}")

text = path.read_text(encoding="utf-8")

old = """    user.is_active = data["is_active"]

    if user.role == Role.COLLECTOR.value and not user.is_active:
        collector_profile = CollectorProfile.query.filter_by(user_id=user.id).first()
        if collector_profile:
            collector_profile.availability_status = "unavailable"

    result = commit_or_rollback()
"""

new = """    user.is_active = data["is_active"]

    # Keep collector operational state synchronized.
    if user.role == Role.COLLECTOR.value:
        collector_profile = CollectorProfile.query.filter_by(
            user_id=user.id
        ).first()

        if user.is_active:
            user.approval_status = ApprovalStatus.APPROVED.value
            if collector_profile:
                collector_profile.availability_status = "available"
        elif collector_profile:
            collector_profile.availability_status = "unavailable"

    result = commit_or_rollback()
"""

if old not in text:
    old = """    user.is_active = data[
        "is_active"
    ]

    if (
        user.role
        == Role.COLLECTOR.value
        and not user.is_active
    ):
        profile = (
            CollectorProfile.query
            .filter_by(
                user_id=user.id
            )
            .first()
        )

        if profile:
            profile.availability_status = (
                "unavailable"
            )

    result = commit_or_rollback()
"""

    new = """    user.is_active = data[
        "is_active"
    ]

    # Keep collector operational state synchronized.
    if user.role == Role.COLLECTOR.value:
        profile = (
            CollectorProfile.query
            .filter_by(
                user_id=user.id
            )
            .first()
        )

        if user.is_active:
            user.approval_status = (
                ApprovalStatus.APPROVED.value
            )
            if profile:
                profile.availability_status = "available"
        elif profile:
            profile.availability_status = "unavailable"

    result = commit_or_rollback()
"""

if old not in text:
    raise SystemExit("Could not find the expected update_user_status block. No code was changed.")

path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("SUCCESS: admin.py updated.")
print("Restart Flask before testing.")
