"""
approvals/ads_queue.py
JSON-file-backed approval queue for ad optimization actions and new campaigns.

This is separate from the organic-post queue (approvals/queue.py).
Queue file: approvals/ads_pending.json

Action types:
  pause_campaign   — pause a campaign
  activate_campaign— resume a paused campaign
  scale_budget     — increase an ad set's daily budget
  reduce_budget    — decrease an ad set's daily budget
  pause_adset      — pause a specific ad set
  flag_review      — human attention needed, no API action taken
  create_campaign  — create a brand-new campaign from a plan
"""

import json
import os
from datetime import datetime

ADS_QUEUE_FILE = os.path.join(os.path.dirname(__file__), "ads_pending.json")

# Human-readable labels for the dashboard
ACTION_LABELS = {
    "pause_campaign":    "⏸ Pause Campaign",
    "activate_campaign": "▶ Activate Campaign",
    "scale_budget":      "📈 Scale Budget",
    "reduce_budget":     "📉 Reduce Budget",
    "pause_adset":       "⏸ Pause Ad Set",
    "flag_review":       "🚩 Flag for Review",
    "create_campaign":   "✨ Create Campaign",
}


def load_ads_queue() -> list[dict]:
    """Read ads_pending.json and return all ad actions."""
    if not os.path.isfile(ADS_QUEUE_FILE):
        return []
    with open(ADS_QUEUE_FILE, "r", encoding="utf-8") as fh:
        try:
            return json.load(fh)
        except json.JSONDecodeError:
            print("[Ads Queue] WARNING: ads_pending.json is corrupted. Starting fresh.")
            return []


def save_ads_queue(actions: list[dict]) -> None:
    """Write the full list of actions to ads_pending.json."""
    os.makedirs(os.path.dirname(ADS_QUEUE_FILE), exist_ok=True)
    with open(ADS_QUEUE_FILE, "w", encoding="utf-8") as fh:
        json.dump(actions, fh, indent=2, ensure_ascii=False)


def add_actions_to_queue(actions: list[dict]) -> int:
    """
    Append a list of optimization action dicts to the queue.
    Sets status = 'pending' and adds a queued_at timestamp.
    Returns the number of actions added.
    """
    existing = load_ads_queue()
    added = 0
    for action in actions:
        entry = {**action}
        entry["status"]    = "pending"
        entry["queued_at"] = datetime.utcnow().isoformat()
        entry.setdefault("type",            "unknown")
        entry.setdefault("target_name",     "—")
        entry.setdefault("target_level",    "campaign")
        entry.setdefault("reason",          "")
        entry.setdefault("priority",        "medium")
        entry.setdefault("current_value",   "")
        entry.setdefault("recommended_value", "")
        entry.setdefault("metrics",         {})
        existing.append(entry)
        added += 1

    save_ads_queue(existing)
    print(f"[Ads Queue] {added} action(s) added to ads queue.")
    return added


def add_campaign_to_queue(campaign_plan: dict, goal: str) -> None:
    """
    Queue a new-campaign creation plan as a single 'create_campaign' action.
    """
    camp = campaign_plan.get("campaign", {})
    entry = {
        "type":              "create_campaign",
        "target_id":         "",
        "target_name":       camp.get("name", "New Campaign"),
        "target_level":      "campaign",
        "current_value":     "—",
        "recommended_value": (
            f"Create | Objective: {camp.get('objective_label', camp.get('objective'))} | "
            f"Budget: ${camp.get('daily_budget_cents', 0)/100:.2f}/day"
        ),
        "reason":         camp.get("rationale", goal),
        "metrics":        {},
        "priority":       "high",
        "campaign_plan":  campaign_plan,
        "status":         "pending",
        "queued_at":      datetime.utcnow().isoformat(),
    }
    existing = load_ads_queue()
    existing.append(entry)
    save_ads_queue(existing)
    print(
        f"[Ads Queue] Campaign plan '{camp.get('name')}' added to ads queue."
    )


def review_ads_queue() -> None:
    """
    Interactive CLI loop for reviewing pending ad actions.

    Commands: y (approve) | n (reject) | s (skip) | q (quit)
    """
    actions = load_ads_queue()
    pending = [a for a in actions if a.get("status") == "pending"]

    if not pending:
        print("\n[Ads Queue] No pending ad actions to review.")
        return

    print(f"\n[Ads Queue] {len(pending)} ad action(s) pending review.\n")
    changed = False

    for action in actions:
        if action.get("status") != "pending":
            continue

        prio  = action.get("priority", "?").upper()
        atype = ACTION_LABELS.get(action["type"], action["type"])

        print("─" * 60)
        print(f"ACTION    : {atype}  [{prio} priority]")
        print(f"TARGET    : {action.get('target_name')} ({action.get('target_level')})")
        print(f"CURRENT   : {action.get('current_value', '—')}")
        print(f"RECOMMEND : {action.get('recommended_value', '—')}")
        print(f"REASON    : {action.get('reason', '—')}")

        metrics = action.get("metrics", {})
        if metrics:
            print(
                f"METRICS   : spend=${metrics.get('spend','?')} | "
                f"CTR={metrics.get('ctr','?')}% | "
                f"CPC=${metrics.get('cpc','?')} | "
                f"impressions={metrics.get('impressions','?')}"
            )

        if action["type"] == "create_campaign":
            plan = action.get("campaign_plan", {})
            adset = plan.get("adset", {})
            copies = plan.get("ad_copies", [])
            targeting = adset.get("targeting", {})
            print(
                f"\nCAMPAIGN PLAN SUMMARY:\n"
                f"  Targeting: {targeting.get('geo_locations',{}).get('countries',[])} | "
                f"Age {targeting.get('age_min',18)}-{targeting.get('age_max',65)} | "
                f"Interests: {[i['name'] for i in targeting.get('interests',[])[:3]]}\n"
                f"  Ad Sets: 1 | Ads: {len(copies)} variants (A/B/C)"
            )
            for copy in copies[:3]:
                print(
                    f"    [{copy.get('variant')}] \"{copy.get('headline')}\" "
                    f"({copy.get('angle')}) — CTA: {copy.get('call_to_action')}"
                )

        print("─" * 60)

        while True:
            choice = input(
                "\n[y] Approve  [n] Reject  [s] Skip  [q] Quit\n> "
            ).strip().lower()

            if choice == "y":
                action["status"]      = "approved"
                action["reviewed_at"] = datetime.utcnow().isoformat()
                print(f"✓ Approved — {atype}")
                changed = True
                break

            elif choice == "n":
                action["status"]      = "rejected"
                action["reviewed_at"] = datetime.utcnow().isoformat()
                reason = input("Rejection reason (optional): ").strip()
                if reason:
                    action["rejection_reason"] = reason
                print(f"✗ Rejected.")
                changed = True
                break

            elif choice == "s":
                print("→ Skipped.")
                break

            elif choice == "q":
                if changed:
                    save_ads_queue(actions)
                    print("[Ads Queue] Changes saved.")
                return

            else:
                print("Invalid. Enter y, n, s, or q.")

    if changed:
        save_ads_queue(actions)
        print("\n[Ads Queue] All changes saved.")

    updated  = load_ads_queue()
    approved = sum(1 for a in updated if a.get("status") == "approved")
    rejected = sum(1 for a in updated if a.get("status") == "rejected")
    pending_count = sum(1 for a in updated if a.get("status") == "pending")
    print(
        f"\n[Ads Queue] Done. "
        f"Approved: {approved} | Rejected: {rejected} | Pending: {pending_count}"
    )
    print("Run  python main.py ads-apply  to apply approved actions.")
