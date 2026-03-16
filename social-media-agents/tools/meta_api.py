"""
tools/meta_api.py
Wrappers for the Meta Graph API v19.0 — Instagram & Facebook.
"""

import requests
from config import PLATFORMS


def _ig_base() -> str:
    cfg = PLATFORMS["instagram"]
    return f"{cfg['graph_api_base']}/{cfg['graph_api_version']}"


def _fb_base() -> str:
    cfg = PLATFORMS["facebook"]
    return f"{cfg['graph_api_base']}/{cfg['graph_api_version']}"


# ---------------------------------------------------------------------------
# Instagram
# ---------------------------------------------------------------------------

def post_to_instagram(caption: str, image_url: str) -> dict:
    """
    Two-step Instagram publish:
      1. Create a media container (returns a container_id).
      2. Publish the container (returns a post_id).

    Returns a dict with 'container_id' and 'post_id', or raises on error.
    """
    cfg = PLATFORMS["instagram"]
    account_id = cfg["account_id"]
    token = cfg["access_token"]
    base = _ig_base()

    print(f"[Meta API] Creating Instagram media container for account {account_id}...")
    try:
        # Step 1 — create container
        container_resp = requests.post(
            f"{base}/{account_id}/media",
            params={
                "image_url": image_url,
                "caption": caption,
                "access_token": token,
            },
            timeout=30,
        )
        container_resp.raise_for_status()
        container_data = container_resp.json()

        if "error" in container_data:
            raise RuntimeError(
                f"Instagram container creation failed: {container_data['error']}"
            )

        container_id = container_data["id"]
        print(f"[Meta API] Container created: {container_id}")

        # Step 2 — publish
        publish_resp = requests.post(
            f"{base}/{account_id}/media_publish",
            params={
                "creation_id": container_id,
                "access_token": token,
            },
            timeout=30,
        )
        publish_resp.raise_for_status()
        publish_data = publish_resp.json()

        if "error" in publish_data:
            raise RuntimeError(
                f"Instagram publish failed: {publish_data['error']}"
            )

        post_id = publish_data["id"]
        print(f"[Meta API] Instagram post published! Post ID: {post_id}")
        return {"container_id": container_id, "post_id": post_id}

    except requests.RequestException as exc:
        print(f"[Meta API] HTTP error posting to Instagram: {exc}")
        raise


def get_instagram_insights(metric: str) -> dict:
    """
    Fetch daily insights for the Instagram Business Account.

    metric examples: 'impressions', 'reach', 'profile_views', 'follower_count'

    Returns the raw API response dict.
    """
    cfg = PLATFORMS["instagram"]
    account_id = cfg["account_id"]
    token = cfg["access_token"]
    base = _ig_base()

    print(f"[Meta API] Fetching Instagram insights: metric='{metric}'...")
    try:
        resp = requests.get(
            f"{base}/{account_id}/insights",
            params={
                "metric": metric,
                "period": "day",
                "access_token": token,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            raise RuntimeError(f"Instagram insights error: {data['error']}")

        print(f"[Meta API] Instagram insights received for '{metric}'.")
        return data

    except requests.RequestException as exc:
        print(f"[Meta API] HTTP error fetching Instagram insights: {exc}")
        raise


# ---------------------------------------------------------------------------
# Facebook
# ---------------------------------------------------------------------------

def post_to_facebook(message: str, image_url: str | None = None) -> dict:
    """
    Post to a Facebook Page feed.

    If image_url is provided, posts to /photos (creates a photo post).
    Otherwise posts a plain text status to /feed.

    Returns a dict with 'post_id'.
    """
    cfg = PLATFORMS["facebook"]
    page_id = cfg["page_id"]
    token = cfg["access_token"]
    base = _fb_base()

    try:
        if image_url:
            print(f"[Meta API] Posting photo to Facebook Page {page_id}...")
            resp = requests.post(
                f"{base}/{page_id}/photos",
                params={
                    "url": image_url,
                    "caption": message,
                    "access_token": token,
                },
                timeout=30,
            )
        else:
            print(f"[Meta API] Posting status to Facebook Page {page_id}...")
            resp = requests.post(
                f"{base}/{page_id}/feed",
                params={
                    "message": message,
                    "access_token": token,
                },
                timeout=30,
            )

        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            raise RuntimeError(f"Facebook post error: {data['error']}")

        post_id = data.get("post_id") or data.get("id", "unknown")
        print(f"[Meta API] Facebook post published! Post ID: {post_id}")
        return {"post_id": post_id}

    except requests.RequestException as exc:
        print(f"[Meta API] HTTP error posting to Facebook: {exc}")
        raise
