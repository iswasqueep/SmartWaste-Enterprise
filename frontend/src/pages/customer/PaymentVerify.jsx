import {
  CheckCircle2,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";

import api from "../../api";
import "../../styles/payment-verify.css";

function PaymentVerify() {
  const [searchParams] =
    useSearchParams();

  const reference =
    searchParams.get("reference");

  const [status, setStatus] =
    useState("loading");

  const [message, setMessage] =
    useState(
      "Confirming your payment..."
    );

  useEffect(() => {
    async function verifyPayment() {
      if (!reference) {
        setStatus("error");
        setMessage(
          "Payment reference is missing."
        );
        return;
      }

      try {
        const response =
          await api.get(
            "/payments/verify",
            {
              params: {
                reference,
              },
            }
          );

        setStatus("success");

        setMessage(
          response.data?.message ||
            "Payment verified successfully."
        );
      } catch (error) {
        setStatus("error");

        setMessage(
          error.response?.data?.error ||
            "Unable to verify this payment."
        );
      }
    }

    verifyPayment();
  }, [reference]);

  return (
    <main className="payment-verify-page">
      <section className="payment-verify-card">
        {status === "loading" && (
          <>
            <div className="payment-verify-icon loading">
              <LoaderCircle
                size={42}
                className="payment-verify-spin"
              />
            </div>

            <h1>
              Verifying payment
            </h1>

            <p>{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="payment-verify-icon success">
              <CheckCircle2
                size={44}
              />
            </div>

            <h1>
              Payment successful
            </h1>

            <p>{message}</p>

            <Link
              to="/payments"
              className="payment-verify-button"
            >
              Return to payments
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="payment-verify-icon error">
              <XCircle size={44} />
            </div>

            <h1>
              Payment verification failed
            </h1>

            <p>{message}</p>

            <Link
              to="/payments"
              className="payment-verify-button"
            >
              Return to payments
            </Link>
          </>
        )}

        {reference && (
          <small>
            Reference: {reference}
          </small>
        )}
      </section>
    </main>
  );
}

export default PaymentVerify;