"""
One-time, idempotent invoice backfill for SmartWaste.

Run from the backend directory:

    python backfill_invoices.py

It creates invoices only for pickups that currently have no invoice.
Existing invoices and payments are never modified.

Run this once to repair historical/test pickup records created before
the invoice-at-pickup workflow was enforced.
"""

from app import create_app
from app.extensions import db
from app.models import PickupRequest
from app.services.billing import create_invoice_for_pickup


app = create_app()

with app.app_context():
    pickups = (
        PickupRequest.query
        .filter(PickupRequest.invoice == None)  # noqa: E711
        .order_by(PickupRequest.id.asc())
        .all()
    )

    created = []

    try:
        for pickup in pickups:
            invoice = create_invoice_for_pickup(pickup)
            created.append(
                (
                    pickup.reference,
                    invoice.invoice_number,
                    float(invoice.total),
                )
            )

        db.session.commit()

    except Exception:
        db.session.rollback()
        raise

    print(
        f"Invoice backfill complete. "
        f"Created {len(created)} invoice(s)."
    )

    for reference, invoice_number, total in created:
        print(
            f"{reference} -> {invoice_number} -> "
            f"NGN {total:,.2f}"
        )
