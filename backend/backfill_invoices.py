"""
One-time/idempotent invoice backfill for SmartWaste.

Run from the backend directory:

    python backfill_invoices.py

This creates invoices for existing pickups that do not already have
one. Existing invoices and payments are not modified.
"""

from app import create_app
from app.extensions import db
from app.models import PickupRequest, PickupStatus
from app.services.billing import create_invoice_for_pickup


app = create_app()


with app.app_context():
    # Repair every legacy pickup that has no invoice, regardless of
    # whether it is pending, assigned, en route, or already collected.
    # This matches the current billing design where each pickup request
    # owns exactly one invoice.
    pickups = (
        PickupRequest.query
        .filter(
            PickupRequest.invoice == None,  # noqa: E711
        )
        .order_by(PickupRequest.id.asc())
        .all()
    )

    created = []

    try:
        for pickup in pickups:
            invoice = create_invoice_for_pickup(pickup)
            created.append(
                {
                    "pickup": pickup.reference,
                    "invoice": invoice.invoice_number,
                    "total": float(invoice.total),
                }
            )

        db.session.commit()

    except Exception:
        db.session.rollback()
        raise

    print(f"Invoice backfill complete. Created {len(created)} invoice(s).")

    for item in created:
        print(
            f"  {item['pickup']} -> "
            f"{item['invoice']} -> "
            f"NGN {item['total']:.2f}"
        )
