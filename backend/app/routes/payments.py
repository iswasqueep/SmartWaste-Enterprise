from datetime import datetime, timezone
from ..paystack import PaystackError, amount_to_subunit, verify_transaction

from flask import (
    Blueprint,
    current_app,
    jsonify,
    request,
)
from flask_jwt_extended import get_jwt_identity

from ..extensions import db
from ..models import (
    Invoice,
    Payment,
    PaymentStatus,
    Role,
)
from ..utils import role_required


payments_bp = Blueprint(
    "payments",
    __name__,
)


def current_user_id():
    """Resolve the authenticated user ID from the JWT identity."""

    identity = get_jwt_identity()

    if isinstance(identity, dict):
        identity = (
            identity.get("id")
            or identity.get("user_id")
            or identity.get("sub")
        )

    try:
        return int(identity)
    except (TypeError, ValueError):
        return None


@payments_bp.get("/payments/verify")
@role_required(Role.CUSTOMER.value)
def verify_customer_payment():
    """
    Verify a customer payment using its transaction reference.

    For the demo payment provider, reaching the callback URL marks the
    transaction as paid. Replace the demo branch with a real Paystack
    verification request when production payment integration is enabled.
    """

    customer_id = current_user_id()

    if not customer_id:
        return jsonify(
            error="Invalid authentication identity"
        ), 401

    reference = str(
        request.args.get(
            "reference",
            "",
        )
    ).strip()

    if not reference:
        return jsonify(
            error="Payment reference is required"
        ), 400

    payment = (
        Payment.query
        .join(
            Invoice,
            Payment.invoice_id == Invoice.id,
        )
        .filter(
            Payment.transaction_reference == reference,
            Invoice.customer_id == customer_id,
        )
        .first()
    )

    if not payment:
        return jsonify(
            error="Payment transaction not found"
        ), 404

    invoice = payment.invoice

    if payment.status == PaymentStatus.PAID.value:
        return jsonify(
            message="Payment has already been verified",
            payment=payment.to_dict(),
            invoice=invoice.to_dict(),
        )

    if invoice.status == PaymentStatus.PAID.value:
        payment.status = PaymentStatus.PAID.value

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

            current_app.logger.exception(
                "Unable to synchronize paid payment"
            )

            return jsonify(
                error="Unable to verify payment"
            ), 500

        return jsonify(
            message="Payment has already been completed",
            payment=payment.to_dict(),
            invoice=invoice.to_dict(),
        )

    provider = str(
        payment.provider
        or current_app.config.get(
            "PAYMENT_PROVIDER",
            "demo",
        )
    ).strip().lower()

    if provider == "demo":
        payment.status = PaymentStatus.PAID.value
        invoice.status = PaymentStatus.PAID.value

        paid_at_column = getattr(
            payment,
            "paid_at",
            None,
        )

        if hasattr(payment, "paid_at"):
            payment.paid_at = datetime.now(
                timezone.utc
            )

        if hasattr(invoice, "paid_at"):
            invoice.paid_at = datetime.now(
                timezone.utc
            )

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

            current_app.logger.exception(
                "Demo payment verification failed"
            )

            return jsonify(
                error="Unable to verify payment"
            ), 500

        return jsonify(
            message="Payment verified successfully",
            payment=payment.to_dict(),
            invoice=invoice.to_dict(),
        )

        if provider == "paystack":
            secret_key = current_app.config.get(
            "PAYSTACK_SECRET_KEY",
            "",
        )

        if not secret_key:
            current_app.logger.error(
                "Paystack verification attempted without a configured secret key"
            )

            return jsonify(
                error="Payment provider is not configured"
            ), 503
        try:
            transaction = verify_transaction(
                secret_key=secret_key,
                reference=reference,
            )

        except PaystackError as error:
            current_app.logger.error(
                "Paystack verification failed: %s",
                error,
            )

            return jsonify(
                error="Unable to verify payment with Paystack"
            ), 502

        except Exception:
            current_app.logger.exception(
                "Unexpected Paystack verification failure"
            )

            return jsonify(
                error="Unable to verify payment"
            ), 500

        transaction_status = str(
            transaction.get("status", "")
        ).strip().lower()

        returned_reference = str(
            transaction.get("reference", "")
        ).strip()

        returned_currency = str(
            transaction.get("currency", "")
        ).strip().upper()

        returned_amount = transaction.get(
            "amount"
        )

        expected_currency = str(
            payment.currency or "NGN"
        ).strip().upper()

        expected_amount = amount_to_subunit(
            payment.amount
        )

        try:
            returned_amount = int(
                returned_amount
            )
        except (TypeError, ValueError):
            returned_amount = None

        # Never mark a payment as successful unless Paystack
        # confirms the transaction itself.
        if transaction_status != "success":
            return jsonify(
                error="Payment has not been completed",
                status=transaction_status or "unknown",
            ), 400

        # Ensure the verified Paystack reference is the
        # reference belonging to this customer's payment.
        if returned_reference != reference:
            current_app.logger.warning(
                "Paystack reference mismatch for payment %s",
                payment.id,
            )

            return jsonify(
                error="Payment reference verification failed"
            ), 400

        # Ensure Paystack charged exactly the amount
        # recorded against this invoice.
        if returned_amount != expected_amount:
            current_app.logger.warning(
                "Paystack amount mismatch for payment %s",
                payment.id,
            )

            return jsonify(
                error="Payment amount verification failed"
            ), 400

        # Ensure the currency matches the invoice/payment.
        if returned_currency != expected_currency:
            current_app.logger.warning(
                "Paystack currency mismatch for payment %s",
                payment.id,
            )

            return jsonify(
                error="Payment currency verification failed"
            ), 400

        payment.status = PaymentStatus.PAID.value
        payment.gateway_reference = (
            str(transaction.get("id"))
            if transaction.get("id") is not None
            else payment.gateway_reference
        )

        payment.paid_at = datetime.now(
            timezone.utc
        )

        invoice.status = PaymentStatus.PAID.value

        if hasattr(invoice, "paid_at"):
            invoice.paid_at = datetime.now(
                timezone.utc
            )

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

            current_app.logger.exception(
                "Paystack payment synchronization failed"
            )

            return jsonify(
                error="Unable to complete payment verification"
            ), 500

        return jsonify(
            message="Payment verified successfully",
            payment=payment.to_dict(),
            invoice=invoice.to_dict(),
        )

    return jsonify(
        error=f"Unsupported payment provider '{provider}'"
    ), 500