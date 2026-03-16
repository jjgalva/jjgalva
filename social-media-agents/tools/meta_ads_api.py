"""
tools/meta_ads_api.py
Wrappers for the Meta Marketing API v19.0.
Covers campaigns, ad sets, ads, creatives, and insights.

All budget values are in cents (e.g. $50.00/day = 5000).
"""

import requests
from config import PLATFORMS

# ── Meta Marketing API uses the same Graph base as the page API ──────────────
_API_VERSION = "v19.0"
_GRAPH_BASE  = "https://graph.facebook.com"


def _base() -> str:
    return f"{_GRAPH_BASE}/{_API_VERSION}"


def _token() -> str:
    # The ad-management token is the Facebook Page access token; it must also
    # have the ads_management and ads_read permissions.
    return PLATFORMS["facebook"]["access_token"]


def _ad_account() -> str:
    from config import META_AD_ACCOUNT_ID
    return f"act_{META_AD_ACCOUNT_ID}"


def _get(path: str, params: dict = None) -> dict:
    p = params or {}
    p["access_token"] = _token()
    resp = requests.get(f"{_base()}/{path}", params=p, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"Meta Ads API error: {data['error']}")
    return data


def _post(path: str, payload: dict = None) -> dict:
    p = payload or {}
    p["access_token"] = _token()
    resp = requests.post(f"{_base()}/{path}", data=p, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"Meta Ads API error: {data['error']}")
    return data


# ─────────────────────────────────────────────────────────────────────────────
# Account overview
# ─────────────────────────────────────────────────────────────────────────────

def get_account_insights(date_preset: str = "last_7d") -> dict:
    """
    Fetch top-level spend and performance metrics for the whole ad account.

    date_preset options: today, yesterday, last_7d, last_14d, last_30d,
                         this_month, last_month
    """
    print(f"[Ads API] Fetching account insights ({date_preset})...")
    fields = "impressions,reach,clicks,spend,ctr,cpc,cpm,actions"
    data = _get(
        f"{_ad_account()}/insights",
        {"fields": fields, "date_preset": date_preset, "level": "account"},
    )
    print("[Ads API] Account insights received.")
    return data.get("data", [{}])[0] if data.get("data") else {}


# ─────────────────────────────────────────────────────────────────────────────
# Campaigns
# ─────────────────────────────────────────────────────────────────────────────

def get_campaigns(status_filter: str = "ACTIVE") -> list[dict]:
    """
    List campaigns for the ad account.

    status_filter: ACTIVE | PAUSED | ALL
    Returns a list of campaign dicts including basic insight fields.
    """
    print(f"[Ads API] Fetching {status_filter} campaigns...")
    fields = (
        "id,name,status,objective,daily_budget,lifetime_budget,"
        "start_time,stop_time,created_time"
    )
    params = {"fields": fields}
    if status_filter != "ALL":
        params["effective_status"] = f'["{status_filter}"]'

    data = _get(f"{_ad_account()}/campaigns", params)
    campaigns = data.get("data", [])
    print(f"[Ads API] Found {len(campaigns)} campaign(s).")
    return campaigns


def get_campaign_insights(campaign_id: str, date_preset: str = "last_7d") -> dict:
    """
    Fetch detailed performance metrics for a specific campaign.

    Returns a flat dict of metrics.
    """
    print(f"[Ads API] Fetching insights for campaign {campaign_id} ({date_preset})...")
    fields = (
        "impressions,reach,clicks,unique_clicks,ctr,unique_ctr,"
        "cpc,cpm,cpp,spend,frequency,"
        "actions,action_values,cost_per_action_type"
    )
    data = _get(
        f"{campaign_id}/insights",
        {"fields": fields, "date_preset": date_preset},
    )
    result = data.get("data", [{}])[0] if data.get("data") else {}
    print(f"[Ads API] Campaign insights received (spend=${result.get('spend', 0)}).")
    return result


def create_campaign(
    name: str,
    objective: str,
    status: str = "PAUSED",
    special_ad_categories: list = None,
) -> dict:
    """
    Create a new ad campaign.

    objective options:
        OUTCOME_AWARENESS, OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT,
        OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_APP_PROMOTION

    status: PAUSED (safe default — lets you review before spending)
    Returns dict with 'id' of the new campaign.
    """
    print(f"[Ads API] Creating campaign '{name}' (objective={objective})...")
    result = _post(
        f"{_ad_account()}/campaigns",
        {
            "name": name,
            "objective": objective,
            "status": status,
            "special_ad_categories": "[]" if not special_ad_categories else str(special_ad_categories),
        },
    )
    print(f"[Ads API] Campaign created: id={result.get('id')}")
    return result


def update_campaign_status(campaign_id: str, status: str) -> dict:
    """
    Set campaign status to ACTIVE or PAUSED.
    """
    print(f"[Ads API] Updating campaign {campaign_id} → status={status}...")
    result = _post(f"{campaign_id}", {"status": status})
    print(f"[Ads API] Campaign status updated.")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Ad Sets
# ─────────────────────────────────────────────────────────────────────────────

def get_adsets(campaign_id: str) -> list[dict]:
    """
    List all ad sets for a given campaign.
    """
    print(f"[Ads API] Fetching ad sets for campaign {campaign_id}...")
    fields = (
        "id,name,status,daily_budget,lifetime_budget,"
        "targeting,optimization_goal,billing_event,bid_amount,"
        "start_time,end_time"
    )
    data = _get(f"{campaign_id}/adsets", {"fields": fields})
    adsets = data.get("data", [])
    print(f"[Ads API] Found {len(adsets)} ad set(s).")
    return adsets


def get_adset_insights(adset_id: str, date_preset: str = "last_7d") -> dict:
    """Fetch performance metrics for a specific ad set."""
    print(f"[Ads API] Fetching insights for ad set {adset_id}...")
    fields = "impressions,reach,clicks,ctr,cpc,cpm,spend,actions,cost_per_action_type"
    data = _get(
        f"{adset_id}/insights",
        {"fields": fields, "date_preset": date_preset},
    )
    return data.get("data", [{}])[0] if data.get("data") else {}


def create_adset(
    campaign_id: str,
    name: str,
    daily_budget_cents: int,
    targeting: dict,
    optimization_goal: str = "LINK_CLICKS",
    billing_event: str = "IMPRESSIONS",
    bid_strategy: str = "LOWEST_COST_WITHOUT_CAP",
    status: str = "PAUSED",
) -> dict:
    """
    Create a new ad set within a campaign.

    daily_budget_cents: budget in cents (e.g. 5000 = $50.00/day)
    optimization_goal: REACH | IMPRESSIONS | LINK_CLICKS | LANDING_PAGE_VIEWS |
                       LEAD_GENERATION | OFFSITE_CONVERSIONS | VALUE
    billing_event: IMPRESSIONS | LINK_CLICKS
    bid_strategy: LOWEST_COST_WITHOUT_CAP | COST_CAP | BID_CAP
    targeting example:
        {
            "geo_locations": {"countries": ["US"]},
            "age_min": 25, "age_max": 55,
            "genders": [1, 2],
            "publisher_platforms": ["facebook", "instagram"]
        }
    """
    import json
    print(f"[Ads API] Creating ad set '{name}' (budget=${daily_budget_cents/100:.2f}/day)...")
    result = _post(
        f"{_ad_account()}/adsets",
        {
            "campaign_id": campaign_id,
            "name": name,
            "daily_budget": daily_budget_cents,
            "billing_event": billing_event,
            "optimization_goal": optimization_goal,
            "bid_strategy": bid_strategy,
            "targeting": json.dumps(targeting),
            "status": status,
        },
    )
    print(f"[Ads API] Ad set created: id={result.get('id')}")
    return result


def update_adset_budget(adset_id: str, new_daily_budget_cents: int) -> dict:
    """
    Change the daily budget of an ad set.
    new_daily_budget_cents: new budget in cents.
    """
    print(
        f"[Ads API] Updating ad set {adset_id} budget → "
        f"${new_daily_budget_cents/100:.2f}/day..."
    )
    result = _post(f"{adset_id}", {"daily_budget": new_daily_budget_cents})
    print("[Ads API] Ad set budget updated.")
    return result


def update_adset_status(adset_id: str, status: str) -> dict:
    """Set ad set status to ACTIVE or PAUSED."""
    print(f"[Ads API] Updating ad set {adset_id} → status={status}...")
    result = _post(f"{adset_id}", {"status": status})
    print("[Ads API] Ad set status updated.")
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Ad Creatives & Ads
# ─────────────────────────────────────────────────────────────────────────────

def create_ad_creative(
    name: str,
    page_id: str,
    message: str,
    headline: str,
    description: str,
    image_url: str,
    link_url: str,
    call_to_action_type: str = "LEARN_MORE",
) -> dict:
    """
    Create an ad creative (the visual + copy combination).

    call_to_action_type options:
        LEARN_MORE, SHOP_NOW, SIGN_UP, BOOK_TRAVEL, CONTACT_US,
        DOWNLOAD, GET_OFFER, GET_QUOTE, SUBSCRIBE, WATCH_MORE
    """
    import json
    print(f"[Ads API] Creating ad creative '{name}'...")

    object_story_spec = {
        "page_id": page_id,
        "link_data": {
            "message": message,
            "link": link_url,
            "image_hash": "",  # Will use image_url instead
            "picture": image_url,
            "name": headline,
            "description": description,
            "call_to_action": {
                "type": call_to_action_type,
                "value": {"link": link_url},
            },
        },
    }

    result = _post(
        f"{_ad_account()}/adcreatives",
        {
            "name": name,
            "object_story_spec": json.dumps(object_story_spec),
        },
    )
    print(f"[Ads API] Ad creative created: id={result.get('id')}")
    return result


def create_ad(adset_id: str, name: str, creative_id: str, status: str = "PAUSED") -> dict:
    """
    Create an ad that links an ad set to a creative.
    """
    print(f"[Ads API] Creating ad '{name}'...")
    import json
    result = _post(
        f"{_ad_account()}/ads",
        {
            "adset_id": adset_id,
            "name": name,
            "creative": json.dumps({"creative_id": creative_id}),
            "status": status,
        },
    )
    print(f"[Ads API] Ad created: id={result.get('id')}")
    return result


def get_ads(adset_id: str) -> list[dict]:
    """List all ads within an ad set, including basic performance data."""
    print(f"[Ads API] Fetching ads for ad set {adset_id}...")
    fields = "id,name,status,creative,created_time"
    data = _get(f"{adset_id}/ads", {"fields": fields})
    ads = data.get("data", [])
    print(f"[Ads API] Found {len(ads)} ad(s).")
    return ads
