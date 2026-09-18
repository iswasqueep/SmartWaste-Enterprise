from datetime import date, timedelta
from decimal import Decimal

from ..extensions import db
from ..models import Invoice, PaymentStatus
from ..utils import make_reference


def create_invoice_for_pickup(pickup):
    """
    Create exactly one pending invoice for a pickup.

    The invoice uses the original estimated weight. Actual collected
    weight is stored separately on PickupRequest and must not overwrite
    the customer's original estimate.

    Idempotent: an existing invoice is returned unchanged.
    """
    if pickup.invoice:
        return pickup.invoice

    if not pickup.waste_category:
        raise ValueError("Cannot create an invoice without a waste category")

    price = Decimal(str(pickup.waste_category.price_per_kg or 0))
    weight = Decimal(str(pickup.estimated_weight or 0))

    subtotal = (price * weight).quantize(Decimal("0.01"))

    # Existing SmartWaste billing rule.
    service_charge = Decimal("500.00")
    subtotal += service_charge

    tax = (subtotal * Decimal("0.075")).quantize(Decimal("0.01"))
    total = subtotal + tax

    invoice = Invoice(
        invoice_number=make_reference("INV"),
        pickup=pickup,
        customer_id=pickup.customer_id,
        subtotal=subtotal,
        tax=tax,
        discount=Decimal("0.00"),
        total=total,
        status=PaymentStatus.PENDING.value,
        due_date=date.today() + timedelta(days=3),
    )

    db.session.add(invoice)
    return invoice
