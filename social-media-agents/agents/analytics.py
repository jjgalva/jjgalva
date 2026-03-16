"""
agents/analytics.py
Fetches real performance data from Meta API and uses Claude to interpret it.
"""

import json
import re

import anthropic

from config import ANTHROPIC_API_KEY, BRAND_VOICE, CLAUDE_MODEL
from tools.meta_api import get_instagram_insights


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _fetch_instagram_data() -> dict:
    """Collect key Instagram metrics. Returns a summary dict."""
    metrics = ["impressions", "reach", "profile_views", "follower_count"]
    data = {}
    for metric in metrics:
        try:
            result = get_instagram_insights(metric)
            # Extract the most recent value from the insights response
            insight_data = result.get("data", [])
            if insight_data:
                values = insight_data[0].get("values", [])
                if values:
                    data[metric] = values[-1].get("value", 0)
                else:
                    data[metric] = 0
            else:
                data[metric] = 0
        except Exception as exc:
            print(f"[Analytics] Warning: could not fetch '{metric}': {exc}")
            data[metric] = "unavailable"
    return data


def analyze_performance() -> dict:
    """
    1. Fetch real data from Meta API.
    2. Ask Claude to interpret the data and return strategic recommendations.

    Returns a parsed dict with keys:
        best_performing_type, recommended_topics,
        optimal_posting_times, growth_summary
    """
    print("\n[Analytics] Starting performance analysis...")

    # --- Fetch real data ---
    print("[Analytics] Fetching Instagram insights from Meta Graph API...")
    instagram_data = _fetch_instagram_data()
    print(f"[Analytics] Instagram data collected: {instagram_data}")

    # Build a human-readable data report for Claude
    data_report = (
        "INSTAGRAM METRICS (last 24h):\n"
        + "\n".join(
            f"  - {k}: {v}" for k, v in instagram_data.items()
        )
        + "\n\n"
        "FACEBOOK METRICS:\n"
        "  (Note: Facebook page metrics require manual retrieval from "
        "the Insights dashboard or additional API scopes.)\n\n"
        "TIKTOK METRICS:\n"
        "  (Note: TikTok analytics require video publish IDs and "
        "the TikTok Analytics API v2.)\n"
    )

    system_prompt = (
        "You are a senior social media analyst. "
        "Analyze the provided performance data and return actionable insights.\n\n"
        f"Brand voice context: {BRAND_VOICE}\n\n"
        "Always respond with a valid JSON object and nothing else. "
        "Do not include markdown fences."
    )

    user_prompt = (
        "Based on the following social media performance data, provide a strategic analysis.\n\n"
        f"{data_report}\n"
        "Consider what content types, topics, and posting times would drive the most "
        "growth and engagement. Respond ONLY with a JSON object using these exact keys:\n"
        "{\n"
        '  "best_performing_type": "short description of best content type",\n'
        '  "recommended_topics": ["topic1", "topic2", "topic3"],\n'
        '  "optimal_posting_times": {"instagram": "HH:MM", "facebook": "HH:MM", "tiktok": "HH:MM"},\n'
        '  "growth_summary": "2-3 sentence strategic summary"\n'
        "}"
    )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        print("[Analytics] Calling Claude to interpret performance data...")
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text
        cleaned = _strip_markdown_fences(raw_text)
        analysis = json.loads(cleaned)

        print("[Analytics] ✓ Performance analysis complete.")
        print(f"[Analytics] Growth summary: {analysis.get('growth_summary', '')}")
        return analysis

    except json.JSONDecodeError as exc:
        print(f"[Analytics] ERROR: Could not parse Claude's JSON: {exc}")
        print(f"[Analytics] Raw response:\n{raw_text}")
        raise
    except anthropic.APIError as exc:
        print(f"[Analytics] ERROR: Anthropic API error: {exc}")
        raise
