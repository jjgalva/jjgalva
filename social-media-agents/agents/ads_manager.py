"""
agents/ads_manager.py
Claude-powered agent for Facebook/Instagram ad campaign management.

Provides three capabilities:
  1. analyze_campaigns()       — audit all active campaigns, queue optimizations
  2. create_campaign_from_goal() — design a full campaign from a business goal
  3. generate_ad_copy()        — produce multiple A/B-testable copy variants
"""

import json
import re
from datetime import datetime

import anthropic

from config import ANTHROPIC_API_KEY, BRAND_VOICE, CLAUDE_MODEL
from tools.meta_ads_api import (
    get_account_insights,
    get_campaigns,
    get_campaign_insights,
    get_adsets,
    get_adset_insights,
)


# ─── helpers ─────────────────────────────────────────────────────────────────

def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _claude(system: str, user: str, max_tokens: int = 2048) -> str:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text


# ─── 1. Campaign Analysis & Optimization ─────────────────────────────────────

def analyze_campaigns(date_preset: str = "last_7d") -> list[dict]:
    """
    1. Pull all active and paused campaigns + their 7-day insights.
    2. Pull ad-set level data for each campaign.
    3. Send everything to Claude for analysis.
    4. Return a list of recommended optimization actions ready to be queued.

    Each action dict has:
      type        : pause_campaign | activate_campaign | scale_budget |
                    reduce_budget | pause_adset | flag_review
      target_id   : campaign_id or adset_id to act on
      target_name : human-readable name
      target_level: "campaign" or "adset"
      current_value    : relevant current metric (budget/status)
      recommended_value: what to change it to (for budget actions)
      reason      : Claude's explanation
      metrics     : snapshot of key numbers
      priority    : "high" | "medium" | "low"
    """
    print("\n[Ads Manager] Starting campaign analysis...")

    # ── Gather data ──────────────────────────────────────────────────────────
    print("[Ads Manager] Fetching account overview...")
    try:
        account_insights = get_account_insights(date_preset)
    except Exception as exc:
        print(f"[Ads Manager] Warning: account insights unavailable: {exc}")
        account_insights = {}

    print("[Ads Manager] Fetching campaigns...")
    try:
        campaigns = get_campaigns(status_filter="ALL")
    except Exception as exc:
        print(f"[Ads Manager] ERROR: Could not fetch campaigns: {exc}")
        return []

    if not campaigns:
        print("[Ads Manager] No campaigns found in this ad account.")
        return []

    # Enrich each campaign with insights and ad set data
    enriched = []
    for c in campaigns[:20]:  # cap at 20 to stay within API limits
        cid = c["id"]
        print(f"[Ads Manager] Fetching insights for campaign: {c.get('name')}...")

        try:
            c["insights"] = get_campaign_insights(cid, date_preset)
        except Exception as exc:
            print(f"[Ads Manager] Warning: insights unavailable for {cid}: {exc}")
            c["insights"] = {}

        try:
            adsets = get_adsets(cid)
            for adset in adsets[:5]:  # cap per campaign
                try:
                    adset["insights"] = get_adset_insights(adset["id"], date_preset)
                except Exception:
                    adset["insights"] = {}
            c["adsets"] = adsets
        except Exception as exc:
            print(f"[Ads Manager] Warning: adsets unavailable for {cid}: {exc}")
            c["adsets"] = []

        enriched.append(c)

    # ── Build data summary for Claude ────────────────────────────────────────
    summary_lines = [
        f"ACCOUNT OVERVIEW ({date_preset}):",
        f"  Total spend: ${account_insights.get('spend', '?')}",
        f"  Impressions: {account_insights.get('impressions', '?')}",
        f"  Clicks: {account_insights.get('clicks', '?')}",
        f"  CTR: {account_insights.get('ctr', '?')}%",
        f"  CPC: ${account_insights.get('cpc', '?')}",
        "",
        "CAMPAIGNS:",
    ]

    for c in enriched:
        ins = c.get("insights", {})
        summary_lines.append(
            f"\n  Campaign: {c['name']} (id={c['id']})\n"
            f"    Status: {c.get('status')} | Objective: {c.get('objective')}\n"
            f"    Budget: ${int(c.get('daily_budget', 0)) / 100:.2f}/day\n"
            f"    Spend: ${ins.get('spend', '?')} | "
            f"Impressions: {ins.get('impressions', '?')} | "
            f"Clicks: {ins.get('clicks', '?')} | "
            f"CTR: {ins.get('ctr', '?')}% | "
            f"CPC: ${ins.get('cpc', '?')}"
        )
        for adset in c.get("adsets", []):
            ai = adset.get("insights", {})
            budget_cents = int(adset.get("daily_budget", 0))
            summary_lines.append(
                f"      AdSet: {adset['name']} (id={adset['id']})\n"
                f"        Budget: ${budget_cents/100:.2f}/day | "
                f"Status: {adset.get('status')} | "
                f"Goal: {adset.get('optimization_goal')}\n"
                f"        Spend: ${ai.get('spend', '?')} | "
                f"CTR: {ai.get('ctr', '?')}% | "
                f"CPC: ${ai.get('cpc', '?')}"
            )

    data_summary = "\n".join(summary_lines)

    # ── Ask Claude ───────────────────────────────────────────────────────────
    system = (
        "You are a senior paid media strategist specializing in Meta (Facebook/Instagram) ads.\n"
        f"Brand context: {BRAND_VOICE}\n\n"
        "Analyze the campaign data and return ONLY a JSON array of optimization actions. "
        "No markdown fences, no explanation outside the JSON.\n\n"
        "Each action object must have exactly these fields:\n"
        '  "type": one of pause_campaign | activate_campaign | scale_budget | '
        'reduce_budget | pause_adset | flag_review\n'
        '  "target_id": the campaign_id or adset_id to act on\n'
        '  "target_name": human-readable name\n'
        '  "target_level": "campaign" or "adset"\n'
        '  "current_value": string describing current budget or status\n'
        '  "recommended_value": string describing recommended change\n'
        '  "reason": 1-2 sentence explanation\n'
        '  "metrics": { "spend": str, "ctr": str, "cpc": str, "impressions": str }\n'
        '  "priority": "high" | "medium" | "low"\n\n'
        "Rules:\n"
        "- Only recommend actions that are clearly justified by the data.\n"
        "- For scale_budget/reduce_budget include the recommended new daily budget in recommended_value.\n"
        "- If there is nothing to optimize, return an empty array []."
    )

    user = (
        f"Analyze this Meta Ads account and return optimization actions:\n\n"
        f"{data_summary}"
    )

    print("[Ads Manager] Calling Claude to analyze campaigns...")
    try:
        raw = _claude(system, user, max_tokens=3000)
        actions = json.loads(_strip_fences(raw))
        if not isinstance(actions, list):
            actions = []
    except (json.JSONDecodeError, Exception) as exc:
        print(f"[Ads Manager] ERROR parsing Claude response: {exc}")
        return []

    print(f"[Ads Manager] ✓ Analysis complete. {len(actions)} optimization(s) recommended.")
    for a in actions:
        prio = a.get("priority", "?").upper()
        print(f"  [{prio}] {a.get('type')} → {a.get('target_name')}: {a.get('reason', '')[:80]}")

    return actions


# ─── 2. Campaign Creation Wizard ─────────────────────────────────────────────

def create_campaign_from_goal(goal: str, website_url: str = "", page_id: str = "") -> dict:
    """
    Given a plain-English marketing goal, Claude designs a complete campaign
    structure including targeting, budget recommendation, and 3 ad copy variants.

    Returns a dict suitable for queuing as a 'create_campaign' action.
    The campaign is NOT created in the API here — it goes through the approval queue first.

    The returned dict shape:
    {
      "campaign": {
        "name": str,
        "objective": str,          # Meta objective constant
        "objective_label": str,    # Human-readable
        "daily_budget_cents": int,
        "rationale": str
      },
      "adset": {
        "name": str,
        "optimization_goal": str,
        "billing_event": str,
        "targeting": {
          "geo_locations": {"countries": [...]},
          "age_min": int, "age_max": int,
          "genders": [1, 2],
          "publisher_platforms": [...],
          "interests": [{"name": str}]
        },
        "targeting_rationale": str
      },
      "ad_copies": [
        {
          "variant": "A" | "B" | "C",
          "headline": str,
          "primary_text": str,
          "description": str,
          "call_to_action": str,   # Meta CTA constant
          "angle": str             # creative angle description
        }
      ],
      "estimated_performance": {
        "estimated_reach": str,
        "estimated_cpc_range": str,
        "notes": str
      }
    }
    """
    print(f"\n[Ads Manager] Designing campaign for goal: '{goal}'...")

    system = (
        "You are a senior Meta Ads strategist and copywriter.\n"
        f"Brand voice: {BRAND_VOICE}\n\n"
        "Design a complete Meta (Facebook + Instagram) ad campaign. "
        "Return ONLY valid JSON — no markdown fences, no commentary.\n\n"
        "Allowed Meta objectives: OUTCOME_AWARENESS, OUTCOME_TRAFFIC, "
        "OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES\n"
        "Allowed CTA types: LEARN_MORE, SHOP_NOW, SIGN_UP, CONTACT_US, "
        "GET_QUOTE, SUBSCRIBE, DOWNLOAD, WATCH_MORE\n"
        "Allowed optimization_goal: REACH, IMPRESSIONS, LINK_CLICKS, "
        "LANDING_PAGE_VIEWS, LEAD_GENERATION, OFFSITE_CONVERSIONS\n"
        "Allowed billing_event: IMPRESSIONS, LINK_CLICKS\n"
        "publisher_platforms options: facebook, instagram, audience_network\n\n"
        "Return this exact JSON structure with all fields filled in:\n"
        "{\n"
        '  "campaign": {\n'
        '    "name": "...",\n'
        '    "objective": "OUTCOME_...",\n'
        '    "objective_label": "...",\n'
        '    "daily_budget_cents": 5000,\n'
        '    "rationale": "..."\n'
        "  },\n"
        '  "adset": {\n'
        '    "name": "...",\n'
        '    "optimization_goal": "...",\n'
        '    "billing_event": "...",\n'
        '    "targeting": {\n'
        '      "geo_locations": {"countries": ["US"]},\n'
        '      "age_min": 25,\n'
        '      "age_max": 54,\n'
        '      "genders": [1, 2],\n'
        '      "publisher_platforms": ["facebook", "instagram"],\n'
        '      "interests": [{"name": "..."}]\n'
        "    },\n"
        '    "targeting_rationale": "..."\n'
        "  },\n"
        '  "ad_copies": [\n'
        '    { "variant": "A", "headline": "...", "primary_text": "...", '
        '"description": "...", "call_to_action": "...", "angle": "..." },\n'
        '    { "variant": "B", ... },\n'
        '    { "variant": "C", ... }\n'
        "  ],\n"
        '  "estimated_performance": {\n'
        '    "estimated_reach": "50,000–150,000 people/day",\n'
        '    "estimated_cpc_range": "$0.80–$1.50",\n'
        '    "notes": "..."\n'
        "  }\n"
        "}"
    )

    context = f"Business goal: {goal}"
    if website_url:
        context += f"\nWebsite URL: {website_url}"
    if page_id:
        context += f"\nFacebook Page ID: {page_id}"

    try:
        raw = _claude(system, context, max_tokens=3000)
        plan = json.loads(_strip_fences(raw))
        plan["_goal"] = goal
        plan["_website_url"] = website_url
        plan["_page_id"] = page_id
        print(
            f"[Ads Manager] ✓ Campaign plan ready: "
            f"'{plan['campaign']['name']}' | "
            f"Objective: {plan['campaign']['objective']} | "
            f"Budget: ${plan['campaign']['daily_budget_cents']/100:.2f}/day"
        )
        return plan
    except json.JSONDecodeError as exc:
        print(f"[Ads Manager] ERROR: Could not parse campaign plan: {exc}")
        raise


# ─── 3. Ad Copy Generation ────────────────────────────────────────────────────

def generate_ad_copy(
    product_description: str,
    target_audience: str,
    objective: str,
    num_variants: int = 3,
) -> list[dict]:
    """
    Generate multiple A/B-testable ad copy variants for a product.

    Args:
        product_description : What the product/service is and its key benefits.
        target_audience     : Who you're targeting (age, interests, pain points).
        objective           : Marketing goal (awareness | traffic | leads | sales).
        num_variants        : Number of copy variants to generate (2–5).

    Returns a list of variant dicts:
        [
          {
            "variant": "A",
            "angle": "Problem/Solution",
            "headline": "...",       # ≤40 chars
            "primary_text": "...",   # ≤125 chars for best display
            "description": "...",   # ≤30 chars
            "call_to_action": "...",
            "tone": "...",
            "why": "..."
          },
          ...
        ]
    """
    print(
        f"\n[Ads Manager] Generating {num_variants} ad copy variant(s) "
        f"for '{product_description[:50]}...'..."
    )

    system = (
        "You are a direct-response copywriter specialising in Meta (Facebook/Instagram) ads.\n"
        f"Brand voice: {BRAND_VOICE}\n\n"
        "Create ad copy variants that are scroll-stopping and conversion-focused. "
        "Each variant must use a DIFFERENT creative angle.\n\n"
        "Return ONLY a JSON array — no markdown fences. Each element:\n"
        '{\n'
        '  "variant": "A",\n'
        '  "angle": "Problem/Solution | Social Proof | Curiosity | FOMO | '
        'Benefit-led | Story | Direct Offer",\n'
        '  "headline": "max 40 chars",\n'
        '  "primary_text": "max 125 chars — the main ad copy",\n'
        '  "description": "max 30 chars — shown under headline on some placements",\n'
        '  "call_to_action": "LEARN_MORE | SHOP_NOW | SIGN_UP | CONTACT_US | GET_QUOTE",\n'
        '  "tone": "one-word description of tone",\n'
        '  "why": "one sentence explaining the creative strategy"\n'
        "}"
    )

    user = (
        f"Product/Service: {product_description}\n"
        f"Target Audience: {target_audience}\n"
        f"Campaign Objective: {objective}\n"
        f"Number of variants needed: {num_variants}\n\n"
        "Generate the copy variants now."
    )

    try:
        raw = _claude(system, user, max_tokens=2000)
        variants = json.loads(_strip_fences(raw))
        if not isinstance(variants, list):
            variants = [variants]
        # Ensure correct variant labels
        for i, v in enumerate(variants):
            v["variant"] = chr(65 + i)  # A, B, C, ...
        print(f"[Ads Manager] ✓ {len(variants)} copy variant(s) generated.")
        for v in variants:
            print(f"  Variant {v['variant']} [{v.get('angle')}]: \"{v.get('headline')}\"")
        return variants
    except json.JSONDecodeError as exc:
        print(f"[Ads Manager] ERROR: Could not parse copy variants: {exc}")
        raise


# ─── 4. Apply an Approved Action ─────────────────────────────────────────────

def apply_action(action: dict) -> dict:
    """
    Execute an approved optimization action against the Meta Marketing API.

    Called by the CLI `ads-apply` command and the dashboard Apply button.
    Returns a result dict with 'ok', 'api_response', and 'applied_at'.
    """
    from tools.meta_ads_api import (
        update_campaign_status,
        update_adset_budget,
        update_adset_status,
        create_campaign,
        create_adset,
        create_ad_creative,
        create_ad,
    )
    from config import PLATFORMS

    action_type = action.get("type")
    target_id   = action.get("target_id", "")
    result      = {}

    print(f"\n[Ads Manager] Applying action: {action_type} on {action.get('target_name')}...")

    if action_type == "pause_campaign":
        result = update_campaign_status(target_id, "PAUSED")

    elif action_type == "activate_campaign":
        result = update_campaign_status(target_id, "ACTIVE")

    elif action_type == "pause_adset":
        result = update_adset_status(target_id, "PAUSED")

    elif action_type in ("scale_budget", "reduce_budget"):
        new_budget = action.get("new_daily_budget_cents")
        if not new_budget:
            raise ValueError(
                "scale_budget/reduce_budget action missing 'new_daily_budget_cents'."
            )
        result = update_adset_budget(target_id, int(new_budget))

    elif action_type == "create_campaign":
        plan = action.get("campaign_plan", {})
        if not plan:
            raise ValueError("create_campaign action missing 'campaign_plan'.")

        campaign_info = plan["campaign"]
        adset_info    = plan["adset"]
        copies        = plan.get("ad_copies", [])
        page_id       = plan.get("_page_id") or PLATFORMS["facebook"]["page_id"]
        website_url   = plan.get("_website_url", "https://example.com")

        # Create campaign (starts PAUSED for safety)
        camp = create_campaign(
            name=campaign_info["name"],
            objective=campaign_info["objective"],
            status="PAUSED",
        )
        campaign_id = camp["id"]

        # Create ad set
        adset = create_adset(
            campaign_id=campaign_id,
            name=adset_info["name"],
            daily_budget_cents=campaign_info["daily_budget_cents"],
            targeting=adset_info["targeting"],
            optimization_goal=adset_info["optimization_goal"],
            billing_event=adset_info["billing_event"],
            status="PAUSED",
        )
        adset_id = adset["id"]

        # Create one ad per copy variant (first 3)
        ad_ids = []
        for copy in copies[:3]:
            creative = create_ad_creative(
                name=f"{campaign_info['name']} — Creative {copy['variant']}",
                page_id=page_id,
                message=copy["primary_text"],
                headline=copy["headline"],
                description=copy["description"],
                image_url="https://placehold.co/1200x628/png",  # replace in prod
                link_url=website_url,
                call_to_action_type=copy.get("call_to_action", "LEARN_MORE"),
            )
            ad = create_ad(
                adset_id=adset_id,
                name=f"{campaign_info['name']} — Ad {copy['variant']}",
                creative_id=creative["id"],
                status="PAUSED",
            )
            ad_ids.append(ad["id"])

        result = {
            "campaign_id": campaign_id,
            "adset_id": adset_id,
            "ad_ids": ad_ids,
        }

    elif action_type == "flag_review":
        # No API call — just acknowledge
        result = {"flagged": True, "target_id": target_id}

    else:
        raise ValueError(f"Unknown action type: '{action_type}'")

    print(f"[Ads Manager] ✓ Action '{action_type}' applied successfully.")
    return {
        "ok": True,
        "api_response": result,
        "applied_at": datetime.utcnow().isoformat(),
    }
