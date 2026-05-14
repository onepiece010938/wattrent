"""
Budget kill-switch.

On receiving a Pub/Sub budget alert, if actual spend >= budget, call the
Cloud Billing API to unset the project's billing account; all paid services
then stop immediately.

Reference: https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
"""

from __future__ import annotations

import base64
import json
import os
from typing import Any

import functions_framework
from googleapiclient import discovery

PROJECT_ID = os.environ["GCP_PROJECT_ID"]
PROJECT_NAME = f"projects/{PROJECT_ID}"


@functions_framework.cloud_event
def kill_billing(cloud_event) -> str:  # type: ignore[no-untyped-def]
    """Eventarc/Pub/Sub Cloud Event handler."""
    data = _decode_event(cloud_event)
    if data is None:
        return "ignored: empty payload"

    cost = float(data.get("costAmount", 0))
    budget = float(data.get("budgetAmount", 0))
    print(f"[budget-killer] project={PROJECT_ID} cost={cost} budget={budget}")

    if budget <= 0:
        return "ignored: budget <= 0"
    if cost < budget:
        return f"within budget ({cost} / {budget})"

    billing = discovery.build("cloudbilling", "v1", cache_discovery=False)
    info = billing.projects().getBillingInfo(name=PROJECT_NAME).execute()
    if not info.get("billingEnabled"):
        return "billing already disabled"

    billing.projects().updateBillingInfo(
        name=PROJECT_NAME,
        body={"billingAccountName": ""},
    ).execute()
    print(f"[budget-killer] BILLING DISABLED on {PROJECT_NAME}")
    return "billing disabled"


def _decode_event(cloud_event) -> dict[str, Any] | None:  # type: ignore[no-untyped-def]
    payload = cloud_event.data or {}
    msg = payload.get("message") or {}
    raw = msg.get("data")
    if not raw:
        return None
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
        return json.loads(decoded)
    except (ValueError, json.JSONDecodeError) as exc:
        print(f"[budget-killer] failed to decode payload: {exc}")
        return None
