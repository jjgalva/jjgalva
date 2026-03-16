"""
agents/engagement.py
Uses Claude to draft brand-voice replies and flag urgent comments.
"""

import json
import re

import anthropic

from config import ANTHROPIC_API_KEY, BRAND_VOICE, CLAUDE_MODEL


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


# Keywords that may signal an urgent situation
_URGENT_SIGNALS = [
    "refund", "lawsuit", "legal", "fraud", "scam", "hate", "discrimination",
    "harassment", "threatening", "terrible", "disgusting", "unacceptable",
    "dangerous", "broken", "injury", "hurt", "toxic", "false advertising",
    "ftc", "bbb", "attorney", "police", "report",
]


def draft_reply(comment: str, post_context: str = "") -> str:
    """
    Generate a brand-voice reply to a social media comment.

    Args:
        comment:      The raw comment text to respond to.
        post_context: Optional description of the post the comment appeared on.

    Returns:
        A ready-to-post reply string.
    """
    print(f"\n[Engagement] Drafting reply to comment: '{comment[:80]}...'")

    system_prompt = (
        "You are a community manager for a brand. "
        "Craft a warm, genuine, and on-brand reply to the comment below.\n\n"
        f"Brand voice: {BRAND_VOICE}\n\n"
        "Rules:\n"
        "- Keep replies under 280 characters.\n"
        "- Acknowledge the commenter by name if their name is visible.\n"
        "- If the comment is a complaint, empathize first, then offer a solution path.\n"
        "- Never argue, never be sarcastic, never make promises you can't keep.\n"
        "- End with a warm sign-off or a call to action.\n"
        "Respond with ONLY the reply text — no quotes, no explanation."
    )

    context_line = f"\nPost context: {post_context}\n" if post_context else ""
    user_prompt = f"{context_line}Comment to reply to:\n\"{comment}\""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        reply = response.content[0].text.strip()
        print(f"[Engagement] ✓ Reply drafted ({len(reply)} chars).")
        return reply

    except anthropic.APIError as exc:
        print(f"[Engagement] ERROR: Anthropic API error: {exc}")
        raise


def flag_urgent(comments: list[str]) -> list[dict]:
    """
    Scan a list of comments and flag those that contain complaints,
    refund requests, legal threats, or other urgent signals.

    Returns a list of dicts for flagged comments:
        [{'comment': str, 'reason': str, 'severity': 'high'|'medium'}]
    """
    if not comments:
        return []

    print(f"\n[Engagement] Scanning {len(comments)} comment(s) for urgent signals...")

    system_prompt = (
        "You are a content moderation assistant. "
        "Analyze each comment and identify those that are urgent — "
        "meaning they contain complaints, refund requests, legal threats, "
        "harassment, safety concerns, or reputation risks.\n\n"
        "Always respond with a valid JSON array and nothing else. "
        "Do not include markdown fences."
    )

    formatted_comments = "\n".join(
        f"{i + 1}. {c}" for i, c in enumerate(comments)
    )

    user_prompt = (
        "Analyze these comments and return a JSON array of ONLY the urgent ones.\n"
        "Each element must have: comment (string), reason (string), "
        "severity ('high' or 'medium').\n"
        "If no comments are urgent, return an empty array [].\n\n"
        f"Comments:\n{formatted_comments}"
    )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text
        cleaned = _strip_markdown_fences(raw_text)
        flagged = json.loads(cleaned)

        if not isinstance(flagged, list):
            flagged = []

        # Also apply fast keyword filter as a safety net
        keyword_flagged = []
        for comment in comments:
            lower = comment.lower()
            hit = next((kw for kw in _URGENT_SIGNALS if kw in lower), None)
            if hit:
                # Check if already in Claude's results
                already = any(
                    f.get("comment", "").strip() == comment.strip()
                    for f in flagged
                )
                if not already:
                    keyword_flagged.append(
                        {
                            "comment": comment,
                            "reason": f"Keyword detected: '{hit}'",
                            "severity": "medium",
                        }
                    )

        all_flagged = flagged + keyword_flagged

        if all_flagged:
            print(
                f"[Engagement] ⚠ {len(all_flagged)} urgent comment(s) flagged "
                f"({sum(1 for f in all_flagged if f.get('severity') == 'high')} high severity)."
            )
        else:
            print("[Engagement] ✓ No urgent comments detected.")

        return all_flagged

    except json.JSONDecodeError as exc:
        print(f"[Engagement] ERROR: Could not parse flagging response: {exc}")
        # Fall back to keyword-only detection
        print("[Engagement] Falling back to keyword detection only.")
        return [
            {
                "comment": c,
                "reason": f"Keyword match",
                "severity": "medium",
            }
            for c in comments
            if any(kw in c.lower() for kw in _URGENT_SIGNALS)
        ]
    except anthropic.APIError as exc:
        print(f"[Engagement] ERROR: Anthropic API error: {exc}")
        raise
