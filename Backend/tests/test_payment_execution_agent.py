import unittest
import os
import tempfile

from app.agents.ledger_agent import SQLiteLedger
from app.agents.orchaestartor_langgraph import run_transaction
from app.agents.payment_execution_agent import run
from app.agents.state import new_transaction_state
from app.core.config import settings
from app.db.database import load_transaction_checkpoint


class LostResponseGateway:
    """Models a provider that completed attempt one but lost its response."""

    def __init__(self):
        self.keys: list[str] = []

    def charge(self, *, amount, currency, receipt, idempotency_key):
        self.keys.append(idempotency_key)
        if len(self.keys) == 1:
            raise TimeoutError("response lost after provider accepted request")
        return {"status": "success", "payment_id": "pay_once"}


class CrashAfterProviderAcceptsGateway:
    def __init__(self):
        self.keys: list[str] = []

    def charge(self, *, amount, currency, receipt, idempotency_key):
        self.keys.append(idempotency_key)
        raise SystemExit("process lost response after provider accepted request")


class SuccessfulGateway:
    def __init__(self):
        self.keys: list[str] = []

    def charge(self, *, amount, currency, receipt, idempotency_key):
        self.keys.append(idempotency_key)
        return {"status": "success", "payment_id": "pay_once"}


class PaymentIdempotencyTests(unittest.TestCase):
    def test_retry_reuses_one_idempotency_key(self):
        state = new_transaction_state(tenant_id="tenant", session_id="session", user_message="buy")
        state.update({
            "guardrail_passed": True,
            "chosen_product": {"product_id": "sku-1", "price": 100.0},
        })
        gateway = LostResponseGateway()

        run(state, gateway)

        self.assertEqual(state["payment_status"], "success")
        self.assertEqual(gateway.keys, ["session:sku-1", "session:sku-1"])
        self.assertEqual(state["idempotency_key"], "session:sku-1")

    def test_key_is_durable_before_gateway_call(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as file:
            database_path = file.name
        previous_path = settings.DATABASE_PATH
        settings.DATABASE_PATH = database_path
        try:
            state = new_transaction_state(tenant_id="tenant", session_id="session", user_message="buy")
            state.update({"guardrail_passed": True, "chosen_product": {"product_id": "sku-1", "price": 100.0}})
            ledger = SQLiteLedger()
            gateway = LostResponseGateway()

            run(state, gateway, before_first_charge=lambda current: ledger.checkpoint(current))

            saved = load_transaction_checkpoint("session", "tenant")
            self.assertEqual(saved["idempotency_key"], "session:sku-1")
            self.assertEqual(gateway.keys[0], saved["idempotency_key"])
        finally:
            settings.DATABASE_PATH = previous_path
            os.unlink(database_path)

    def test_resume_uses_checkpointed_key_and_skips_completed_agents(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as file:
            database_path = file.name
        previous_path = settings.DATABASE_PATH
        settings.DATABASE_PATH = database_path
        try:
            ledger = SQLiteLedger()
            catalog = [{"product_id": "sku-1", "category": "shirt", "price": 100.0, "sizes": ["M"], "color": "blue", "in_stock": True}]
            transaction = {"amount": 100.0, "type": "PAYMENT", "old_balance_orig": 1_000.0, "new_balance_orig": 900.0, "old_balance_dest": 0.0, "new_balance_dest": 100.0}
            crashed_gateway = CrashAfterProviderAcceptsGateway()
            with self.assertRaises(SystemExit):
                run_transaction(tenant_id="tenant", session_id="resume-session", user_message="blue shirt size M rating 4 stars between ₹50 and ₹1000", catalog=catalog, guardrail_ceiling=1_000.0, transaction=transaction, gateway=crashed_gateway, ledger=ledger, autonomy_mode="autonomous")

            resumed_gateway = SuccessfulGateway()
            resumed = run_transaction(tenant_id="tenant", session_id="resume-session", user_message="ignored on resume", catalog=catalog, guardrail_ceiling=1_000.0, transaction=transaction, gateway=resumed_gateway, ledger=ledger, autonomy_mode="autonomous")

            self.assertEqual(resumed["payment_status"], "success")
            self.assertEqual(crashed_gateway.keys, resumed_gateway.keys)
            self.assertEqual([event["agent"] for event in resumed["audit_log"]].count("concierge"), 1)
        finally:
            settings.DATABASE_PATH = previous_path
            os.unlink(database_path)


if __name__ == "__main__":
    unittest.main()
