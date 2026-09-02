"""
AWS Step Functions AI Agent Orchestrator.

Orchestrates the 6-agent transaction pipeline via AWS Step Functions State Machine.
If AWS credentials or state machine ARN are unavailable, automatically falls back to
the local LangGraph / pure Python transaction graph runner.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.core.config import settings
from app.agents.orchaestartor_langgraph import run_transaction as local_run_transaction
from app.services.aws_eventbridge import event_bridge

logger = logging.getLogger("glassbox.stepfunctions")


class StepFunctionsOrchestrator:
    """AWS Step Functions state machine client with local fallback."""

    def __init__(self) -> None:
        self.enabled = settings.ENABLE_AWS_STEP_FUNCTIONS
        self.state_machine_arn = settings.AWS_STEP_FUNCTIONS_ARN
        self.region = settings.AWS_REGION

    def run_pipeline(
        self,
        *,
        tenant_id: str,
        user_message: str,
        catalog: Any,
        guardrail_ceiling: float,
        transaction: dict[str, Any],
        gateway: Any = None,
        session_id: str | None = None,
        ledger: Any = None,
        autonomy_mode: str | None = None,
        requested_sites: list[str] | None = None,
        buyer_approved: bool = False,
        accept_upsell: bool = False,
        delivery_address: dict[str, Any] | None = None,
        on_checkpoint: Any = None,
    ) -> dict[str, Any]:
        """
        Execute transaction pipeline via AWS Step Functions state machine or local LangGraph fallback.
        """
        if not self.enabled or not self.state_machine_arn:
            logger.info("[StepFunctions] AWS Step Functions disabled or ARN missing. Executing via local fallback pipeline.")
            return local_run_transaction(
                tenant_id=tenant_id,
                user_message=user_message,
                catalog=catalog,
                guardrail_ceiling=guardrail_ceiling,
                transaction=transaction,
                gateway=gateway,
                session_id=session_id,
                ledger=ledger,
                autonomy_mode=autonomy_mode,
                requested_sites=requested_sites,
                buyer_approved=buyer_approved,
                accept_upsell=accept_upsell,
                delivery_address=delivery_address,
                on_checkpoint=on_checkpoint,
            )

        try:
            import boto3
            client = boto3.client("stepfunctions", region_name=self.region)

            initial_state = {
                "tenant_id": tenant_id,
                "user_message": user_message,
                "catalog": list(catalog),
                "guardrail_ceiling": guardrail_ceiling,
                "transaction": transaction,
                "session_id": session_id,
                "autonomy_mode": autonomy_mode,
                "requested_sites": requested_sites,
                "buyer_approved": buyer_approved,
                "accept_upsell": accept_upsell,
                "delivery_address": delivery_address,
            }

            event_bridge.publish_event(
                "GlassBox.Transaction.Started",
                {"session_id": session_id, "tenant_id": tenant_id, "mode": "aws_step_functions"},
            )

            response = client.start_execution(
                stateMachineArn=self.state_machine_arn,
                name=f"gb-{session_id}-{int(time.time())}"[:80],
                input=json.dumps(initial_state, default=str),
            )
            execution_arn = response["executionArn"]
            logger.info(f"[StepFunctions] Started state machine execution: {execution_arn}")

            # Poll state machine completion (timeout 30s)
            start_time = time.time()
            while time.time() - start_time < 30.0:
                desc = client.describe_execution(executionArn=execution_arn)
                status = desc["status"]
                if status == "SUCCEEDED":
                    output = json.loads(desc.get("output", "{}"))
                    logger.info(f"[StepFunctions] Execution succeeded for session {session_id}")
                    if on_checkpoint and isinstance(output, dict):
                        on_checkpoint(output)
                    return output
                elif status in ("FAILED", "TIMED_OUT", "ABORTED"):
                    logger.error(f"[StepFunctions] State machine execution {status}: {desc.get('error')}")
                    break
                time.sleep(0.5)

            logger.warning("[StepFunctions] Execution timed out or failed. Falling back to local runner.")
        except Exception as exc:
            logger.warning(f"[StepFunctions] Exception during execution: {exc}. Falling back to local runner.")

        # Fallback to local LangGraph runner
        return local_run_transaction(
            tenant_id=tenant_id,
            user_message=user_message,
            catalog=catalog,
            guardrail_ceiling=guardrail_ceiling,
            transaction=transaction,
            gateway=gateway,
            session_id=session_id,
            ledger=ledger,
            autonomy_mode=autonomy_mode,
            requested_sites=requested_sites,
            buyer_approved=buyer_approved,
            accept_upsell=accept_upsell,
            delivery_address=delivery_address,
            on_checkpoint=on_checkpoint,
        )


step_functions_orchestrator = StepFunctionsOrchestrator()
