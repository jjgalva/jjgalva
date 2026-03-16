"""
agents/content_creator.py
Uses Claude to generate platform-specific social media content.
"""

import json
import re

import anthropic

from config import ANTHROPIC_API_KEY, BRAND_VOICE, CLAUDE_MODEL
from tools.memory import get_similar_posts, get_top_performing


def _strip_markdown_fences(text: str) -> str:
    """Remove leading/trailing ```json ... ``` or ``` ... ``` fences."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _platform_rules(platform: str) -> str:
    rules = {
        "instagram": (
            "Platform rules for Instagram:\n"
            "- Use 5–15 relevant hashtags at the end of the caption.\n"
            "- Include 1–3 emojis to boost engagement.\n"
            "- Keep the caption under 2,200 characters.\n"
            "- Start with a compelling hook in the first line (visible before 'more').\n"
            "- Encourage saves and shares.\n"
            "- best_time_to_post should be between 09:00 and 11:00 or 18:00 and 21:00.\n"
        ),
        "facebook": (
            "Platform rules for Facebook:\n"
            "- Write in a conversational, friendly tone.\n"
            "- End with an open-ended question to spark discussion.\n"
            "- Keep it under 500 characters for best reach, or use a structured longer post.\n"
            "- Avoid excessive hashtags — 1 or 2 at most.\n"
            "- best_time_to_post should be between 12:00 and 15:00 or 19:00 and 21:00.\n"
        ),
        "tiktok": (
            "Platform rules for TikTok:\n"
            "- Open with a strong hook (first 2 seconds must grab attention).\n"
            "- Keep the caption short — under 150 characters.\n"
            "- Use 3–5 trending, relevant hashtags.\n"
            "- suggested_visual should describe a short, dynamic video concept.\n"
            "- best_time_to_post should be between 07:00 and 09:00 or 19:00 and 23:00.\n"
        ),
    }
    return rules.get(platform, "")


def create_content(topic: str, platform: str) -> dict:
    """
    Generate a social media post for the given topic and platform.

    Returns a parsed dict with keys:
        caption, hashtags, suggested_visual, best_time_to_post, platform
    """
    print(f"\n[Content Creator] Generating {platform} content for topic: '{topic}'...")

    # Pull memory context to avoid repetition
    similar = get_similar_posts(query=f"{platform} {topic}", n=5)
    top_posts = get_top_performing(platform=platform, n=3)

    similar_section = ""
    if similar:
        similar_section = "\n\nPAST POSTS (avoid repeating these themes/phrases):\n"
        for i, p in enumerate(similar, 1):
            similar_section += f"{i}. [{p['platform']}] {p['content'][:200]}\n"

    top_section = ""
    if top_posts:
        top_section = "\n\nTOP PERFORMING POSTS (use these as style inspiration):\n"
        for i, p in enumerate(top_posts, 1):
            top_section += (
                f"{i}. [score={p['engagement_score']}] {p['content'][:200]}\n"
            )

    system_prompt = (
        f"You are an expert social media content creator.\n\n"
        f"Brand voice: {BRAND_VOICE}\n\n"
        f"{_platform_rules(platform)}\n"
        "Always respond with a valid JSON object and nothing else. "
        "Do not include markdown fences."
    )

    user_prompt = (
        f"Create an engaging {platform} post about: {topic}\n"
        f"{similar_section}"
        f"{top_section}\n\n"
        "Respond ONLY with a JSON object using these exact keys:\n"
        "{\n"
        '  "caption": "full post text here",\n'
        '  "hashtags": ["hashtag1", "hashtag2"],\n'
        '  "suggested_visual": "description of the ideal image or video",\n'
        '  "best_time_to_post": "HH:MM",\n'
        f'  "platform": "{platform}"\n'
        "}"
    )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        print(f"[Content Creator] Calling Claude for {platform} post...")
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text
        cleaned = _strip_markdown_fences(raw_text)
        post_data = json.loads(cleaned)

        # Ensure required keys exist with sensible defaults
        post_data.setdefault("platform", platform)
        post_data.setdefault("hashtags", [])
        post_data.setdefault("suggested_visual", "")
        post_data.setdefault("best_time_to_post", "09:00")
        post_data.setdefault("status", "pending")

        print(
            f"[Content Creator] ✓ {platform} post generated. "
            f"Best time: {post_data.get('best_time_to_post')}"
        )
        return post_data

    except json.JSONDecodeError as exc:
        print(f"[Content Creator] ERROR: Could not parse Claude's JSON response: {exc}")
        print(f"[Content Creator] Raw response was:\n{raw_text}")
        raise
    except anthropic.APIError as exc:
        print(f"[Content Creator] ERROR: Anthropic API error: {exc}")
        raise
