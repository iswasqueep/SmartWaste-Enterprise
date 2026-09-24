import json
from decimal import Decimal, ROUND_HALF_UP
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


PAYSTACK_BASE_URL = "https://api.paystack.co"
PAYSTACK_TIMEOUT = 15


class PaystackError(Exception):
    """Raised when a Paystack API operation fails."""


def _request(method, endpoint, secret_key, payload=None):
    if not secret_key:
        raise PaystackError("Paystack secret key is not configured.")

    url = f"{PAYSTACK_BASE_URL}{endpoint}"

    body = None
    headers = {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    request = Request(
        url,
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with urlopen(request, timeout=PAYSTACK_TIMEOUT) as response:
            raw_body = response.read().decode("utf-8")
    except HTTPError as error:
        try:
            raw_body = error.read().decode("utf-8")
        except Exception:
            raw_body = ""

        raise PaystackError(
            f"Paystack API returned HTTP {error.code}: {raw_body[:300]}"
        ) from error
    except URLError as error:
        raise PaystackError(
            "Unable to connect to Paystack."
        ) from error
    except TimeoutError as error:
        raise PaystackError(
            "Paystack request timed out."
        ) from error

    try:
        result = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise PaystackError(
            "Paystack returned an invalid response."
        ) from error

    if not result.get("status"):
        raise PaystackError(
            result.get("message") or "Paystack request was unsuccessful."
        )

    return result


def amount_to_subunit(amount):
    """
    Convert a major-unit amount such as NGN 780.50
    to Paystack's subunit representation: 78050.
    """

    value = Decimal(str(amount or 0))

    return int(
        (value * Decimal("100")).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )


def initialize_transaction(
    secret_key,
    email,
    amount,
    currency,
    reference,
    callback_url,
):
    payload = {
        "email": email,
        "amount": str(amount_to_subunit(amount)),
        "currency": currency,
        "reference": reference,
        "callback_url": callback_url,
    }

    result = _request(
        "POST",
        "/transaction/initialize",
        secret_key,
        payload,
    )

    data = result.get("data") or {}

    authorization_url = data.get("authorization_url")

    if not authorization_url:
        raise PaystackError(
            "Paystack did not return an authorization URL."
        )

    returned_reference = data.get("reference")

    if returned_reference and returned_reference != reference:
        raise PaystackError(
            "Paystack returned an unexpected transaction reference."
        )

    return {
        "authorization_url": authorization_url,
        "access_code": data.get("access_code"),
        "reference": returned_reference or reference,
    }


def verify_transaction(secret_key, reference):
    safe_reference = quote(str(reference), safe="")

    result = _request(
        "GET",
        f"/transaction/verify/{safe_reference}",
        secret_key,
    )

    return result.get("data") or {}