from pathlib import Path
import shutil
from datetime import datetime

root = Path.cwd()
path = root / "backend" / "app" / "routes" / "admin.py"

if not path.exists():
    raise SystemExit(f"Cannot find {path}. Run from the SmartWaste-Enterprise project root.")

text = path.read_text(encoding="utf-8")

old = (
    '            "user": {\n'
    '                "id": c.user.id,\n'
    '                "full_name": c.user.full_name,\n'
    '                "email": c.user.email,\n'
    '                "phone": c.user.phone,\n'
    '            },\n'
)

new = (
    '            "user": {\n'
    '                "id": c.user.id,\n'
    '                "full_name": c.user.full_name,\n'
    '                "email": c.user.email,\n'
    '                "phone": c.user.phone,\n'
    '                "is_active": c.user.is_active,\n'
    '                "approval_status": c.user.approval_status,\n'
    '            },\n'
)

if old not in text:
    raise SystemExit(
        "The expected collector user response block was not found. No changes were made."
    )

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = path.with_suffix(path.suffix + f".backup_{stamp}")
shutil.copy2(path, backup)
print(f"Backup created: {backup}")

path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("SUCCESS: /admin/collectors now returns is_active and approval_status.")
print("Restart Flask and refresh the Collectors page.")
