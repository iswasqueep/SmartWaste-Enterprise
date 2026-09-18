from pathlib import Path
import shutil
from datetime import datetime

ROOT = Path.cwd()
ADMIN = ROOT / "backend" / "app" / "routes" / "admin.py"
USERS = ROOT / "frontend" / "src" / "pages" / "Users.jsx"

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

if not ADMIN.exists():
    raise SystemExit(f"Cannot find {ADMIN}. Run this script from your SmartWaste-Enterprise project root.")
if not USERS.exists():
    raise SystemExit(f"Cannot find {USERS}. Run this script from your SmartWaste-Enterprise project root.")

for path in (ADMIN, USERS):
    backup = path.with_suffix(path.suffix + f".backup_{stamp}")
    shutil.copy2(path, backup)
    print(f"Backup created: {backup}")

admin_text = ADMIN.read_text(encoding="utf-8")

old = '''    user.is_active = data[
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
'''

new = '''    user.is_active = data[
        "is_active"
    ]

    # Keep collector approval, account status and availability synchronized.
    if user.role == Role.COLLECTOR.value:
        profile = (
            CollectorProfile.query
            .filter_by(
                user_id=user.id
            )
            .first()
        )

        if user.is_active:
            user.approval_status = ApprovalStatus.APPROVED.value
            if profile:
                profile.availability_status = "available"
        elif profile:
            profile.availability_status = "unavailable"
'''

if old in admin_text:
    admin_text = admin_text.replace(old, new, 1)
else:
    old2 = '''    user.is_active = data[
        "is_active"
    ]
'''
    new2 = '''    user.is_active = data[
        "is_active"
    ]

    # Keep collector approval and account status synchronized.
    if user.role == Role.COLLECTOR.value and user.is_active:
        user.approval_status = ApprovalStatus.APPROVED.value

        profile = (
            CollectorProfile.query
            .filter_by(user_id=user.id)
            .first()
        )
        if profile:
            profile.availability_status = "available"
'''
    if old2 not in admin_text:
        raise SystemExit(
            "Could not locate the expected update_user_status block in admin.py. "
            "No backend change was made."
        )
    admin_text = admin_text.replace(old2, new2, 1)

ADMIN.write_text(admin_text, encoding="utf-8")
print("Backend collector approval/status synchronization applied.")

users_text = USERS.read_text(encoding="utf-8")

old_update = '''      await api.patch(`/admin/users/${user.id}/approval`, { approval_status });
      setUsers(list => list.map(item => item.id === user.id ? { ...item, approval_status } : item));
      setSelected(item => item?.id === user.id ? { ...item, approval_status } : item);
      setMessage(`User ${approval_status} successfully.`);
'''

new_update = '''      const response = await api.patch(
        `/admin/users/${user.id}/approval`,
        { approval_status },
      );

      const serverUser = normalizeUser(
        response.data?.user || {
          ...user,
          approval_status,
          is_active:
            approval_status === "approved"
              ? true
              : approval_status === "rejected"
                ? false
                : user.is_active,
        },
      );

      setUsers((list) =>
        list.map((item) =>
          item.id === user.id
            ? { ...item, ...serverUser }
            : item,
        ),
      );

      setSelected((item) =>
        item?.id === user.id
          ? { ...item, ...serverUser }
          : item,
      );

      setMessage(
        `User ${serverUser.approval_status} successfully.`,
      );

      await loadUsers();
'''

if old_update not in users_text:
    raise SystemExit(
        "Could not locate the expected updateApproval block in Users.jsx. "
        "No frontend change was made."
    )

users_text = users_text.replace(old_update, new_update, 1)

old_status = '''      await api.patch(`/admin/users/${user.id}/status`, { is_active });
      setUsers(list => list.map(item => item.id === user.id ? { ...item, is_active } : item));
      setSelected(item => item?.id === user.id ? { ...item, is_active } : item);
      setMessage(`User account ${is_active ? "activated" : "deactivated"}.`);
'''

new_status = '''      const response = await api.patch(
        `/admin/users/${user.id}/status`,
        { is_active },
      );

      const serverUser = normalizeUser(
        response.data?.user || {
          ...user,
          is_active,
          ...(user.role === "collector" && is_active
            ? { approval_status: "approved" }
            : {}),
        },
      );

      setUsers((list) =>
        list.map((item) =>
          item.id === user.id
            ? { ...item, ...serverUser }
            : item,
        ),
      );

      setSelected((item) =>
        item?.id === user.id
          ? { ...item, ...serverUser }
          : item,
      );

      setMessage(
        `User account ${is_active ? "activated" : "deactivated"}.`,
      );

      await loadUsers();
'''

if old_status in users_text:
    users_text = users_text.replace(old_status, new_status, 1)

USERS.write_text(users_text, encoding="utf-8")
print("Frontend now uses authoritative server state after approval/status changes.")
print("Fix applied successfully.")
