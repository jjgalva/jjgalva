"""
main.py
CLI entry point for the social media management system.

Commands:
    python main.py run       — prompt for a goal, run the full orchestration pipeline
    python main.py review    — interactively approve / reject queued posts (CLI)
    python main.py post      — publish all approved posts to their platforms
    python main.py dashboard — launch the web approval dashboard (http://localhost:5000)
"""

import sys


def cmd_run() -> None:
    """Prompt the user for a goal and run the full agent pipeline."""
    print("\n" + "=" * 60)
    print("  SOCIAL MEDIA AGENTS — Run Pipeline")
    print("=" * 60)
    print(
        "\nDescribe your content goal.\n"
        "Example: 'Promote our new summer collection with a focus on sustainability'\n"
    )
    goal = input("Goal: ").strip()

    if not goal:
        print("ERROR: No goal provided. Please enter a content goal.")
        sys.exit(1)

    from agents.orchestrator import run
    run(goal)


def cmd_review() -> None:
    """Launch the interactive approval-queue review loop."""
    print("\n" + "=" * 60)
    print("  SOCIAL MEDIA AGENTS — Review Queue")
    print("=" * 60)

    from approvals.queue import review_queue
    review_queue()


def cmd_post() -> None:
    """
    Publish all approved posts to their respective platforms,
    then mark each as 'published' in the queue.
    """
    print("\n" + "=" * 60)
    print("  SOCIAL MEDIA AGENTS — Publish Approved Posts")
    print("=" * 60)

    from approvals.queue import load_queue, save_queue

    posts = load_queue()
    approved = [p for p in posts if p.get("status") == "approved"]

    if not approved:
        print("\n[Post] No approved posts to publish.")
        print("Run  python main.py review  to approve posts first.")
        return

    print(f"\n[Post] Found {len(approved)} approved post(s) to publish.\n")

    from datetime import datetime

    for post in posts:
        if post.get("status") != "approved":
            continue

        platform = post.get("platform", "unknown")
        caption = post.get("caption", "")
        hashtags = " ".join(post.get("hashtags", []))
        full_caption = f"{caption}\n\n{hashtags}".strip() if hashtags else caption
        suggested_visual = post.get("suggested_visual", "")

        print(f"─" * 60)
        print(f"Publishing to: {platform.upper()}")
        print(f"Caption preview: {full_caption[:120]}...")

        try:
            if platform == "instagram":
                from tools.meta_api import post_to_instagram

                # Use a placeholder image URL if none is available.
                # In production, the suggested_visual would be resolved to a
                # real image URL before reaching this point.
                image_url = _resolve_image_url(suggested_visual)
                result = post_to_instagram(
                    caption=full_caption, image_url=image_url
                )
                print(f"[Post] ✓ Instagram published! Result: {result}")

            elif platform == "facebook":
                from tools.meta_api import post_to_facebook

                result = post_to_facebook(message=full_caption)
                print(f"[Post] ✓ Facebook published! Result: {result}")

            elif platform == "tiktok":
                from tools.tiktok_api import upload_tiktok_video

                # TikTok requires a local video file. If none exists, we log
                # a clear message and skip rather than failing silently.
                video_path = _resolve_video_path(platform)
                if not video_path:
                    print(
                        f"[Post] ⚠  Skipping TikTok: no local video file found. "
                        "Upload a video to 'videos/tiktok.mp4' and re-run."
                    )
                    continue

                publish_id = upload_tiktok_video(
                    video_path=video_path, caption=full_caption
                )
                print(
                    f"[Post] ✓ TikTok upload initiated! Publish ID: {publish_id}"
                )

            else:
                print(f"[Post] WARNING: Unknown platform '{platform}' — skipping.")
                continue

            # Mark as published
            post["status"] = "published"
            post["published_at"] = datetime.utcnow().isoformat()

        except Exception as exc:
            print(f"[Post] ERROR publishing to {platform}: {exc}")
            print(f"[Post] Post remains 'approved' so you can retry later.")

    save_queue(posts)
    published_count = sum(1 for p in posts if p.get("status") == "published")
    print(f"\n[Post] Done. {published_count} total post(s) marked as published.")


def _resolve_image_url(suggested_visual: str) -> str:
    """
    In a production system, this would call an image generation API
    (e.g., DALL-E, Stable Diffusion) or asset management system.
    For now, return a publicly accessible placeholder image.
    """
    # Placeholder — replace with real image URL or generation logic
    return "https://placehold.co/1080x1080/png"


def _resolve_video_path(platform: str) -> str | None:
    """
    Look for a local video file to upload to TikTok.
    Checks ./videos/tiktok.mp4 by default.
    """
    import os

    candidates = [
        os.path.join("videos", "tiktok.mp4"),
        os.path.join("videos", "tiktok.mov"),
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def cmd_dashboard() -> None:
    """Launch the Flask web dashboard for post approval."""
    import os
    from dashboard import app

    port = int(os.environ.get("DASHBOARD_PORT", 5000))
    print(f"\n[Dashboard] Starting on http://localhost:{port}")
    print("[Dashboard] Press Ctrl+C to stop.\n")
    app.run(debug=True, port=port)


def cmd_ads_analyze() -> None:
    """
    Fetch all active/paused campaigns, have Claude audit them, and queue
    the recommended optimization actions for human review.
    """
    print("\n" + "=" * 60)
    print("  SOCIAL MEDIA AGENTS — Ads: Analyze Campaigns")
    print("=" * 60)

    preset = input(
        "\nDate range for analysis?\n"
        "  [1] Last 7 days (default)\n"
        "  [2] Last 14 days\n"
        "  [3] Last 30 days\n"
        "> "
    ).strip()
    date_map = {"1": "last_7d", "2": "last_14d", "3": "last_30d"}
    date_preset = date_map.get(preset, "last_7d")

    from agents.ads_manager import analyze_campaigns
    from approvals.ads_queue import add_actions_to_queue

    actions = analyze_campaigns(date_preset=date_preset)
    if not actions:
        print("\n[Ads] No optimization actions recommended. Campaigns look healthy!")
        return

    added = add_actions_to_queue(actions)
    print(
        f"\n[Ads] {added} action(s) queued. "
        "Run  python main.py ads-review  or open the dashboard to approve."
    )


def cmd_ads_create() -> None:
    """
    Interactively design a new Meta ad campaign using Claude, then queue
    the plan for human approval before any API call is made.
    """
    print("\n" + "=" * 60)
    print("  SOCIAL MEDIA AGENTS — Ads: Create Campaign")
    print("=" * 60)
    print(
        "\nDescribe your advertising goal in plain English.\n"
        "Example: 'Drive online sales of our new running shoes to fitness "
        "enthusiasts aged 25-40 in the US and Canada'\n"
    )
    goal = input("Goal: ").strip()
    if not goal:
        print("ERROR: No goal provided.")
        sys.exit(1)

    website_url = input("Website / landing page URL (optional): ").strip()

    from config import PLATFORMS
    default_page = PLATFORMS["facebook"].get("page_id", "")
    page_id_input = input(
        f"Facebook Page ID [{default_page or 'enter manually'}]: "
    ).strip()
    page_id = page_id_input or default_page

    from agents.ads_manager import create_campaign_from_goal
    from approvals.ads_queue import add_campaign_to_queue

    plan = create_campaign_from_goal(goal, website_url=website_url, page_id=page_id)
    add_campaign_to_queue(plan, goal)

    print(
        "\n[Ads] Campaign plan queued. "
        "Run  python main.py ads-review  or open the dashboard to review and approve."
    )


def cmd_ads_copy() -> None:
    """
    Generate A/B-testable ad copy variants using Claude and print them.
    No queue — this is for ideation / copy testing.
    """
    print("\n" + "=" * 60)
    print("  SOCIAL MEDIA AGENTS — Ads: Generate Ad Copy")
    print("=" * 60)

    product = input("\nProduct / service description: ").strip()
    audience = input("Target audience (age, interests, pain points): ").strip()
    print(
        "Objective?\n"
        "  [1] Awareness  [2] Traffic  [3] Leads  [4] Sales (default: Traffic)"
    )
    obj_map = {"1": "awareness", "2": "traffic", "3": "leads", "4": "sales"}
    obj_choice = input("> ").strip()
    objective = obj_map.get(obj_choice, "traffic")

    n_input = input("Number of variants [3]: ").strip()
    num_variants = int(n_input) if n_input.isdigit() else 3

    from agents.ads_manager import generate_ad_copy
    variants = generate_ad_copy(product, audience, objective, num_variants)

    print("\n" + "=" * 60)
    print("  GENERATED AD COPY VARIANTS")
    print("=" * 60)
    for v in variants:
        print(f"\n── Variant {v['variant']} ── {v.get('angle')} ──")
        print(f"  Headline      : {v.get('headline')}")
        print(f"  Primary Text  : {v.get('primary_text')}")
        print(f"  Description   : {v.get('description')}")
        print(f"  CTA           : {v.get('call_to_action')}")
        print(f"  Tone          : {v.get('tone')}")
        print(f"  Strategy      : {v.get('why')}")


def cmd_ads_review() -> None:
    """Interactive CLI review of pending ad actions."""
    print("\n" + "=" * 60)
    print("  SOCIAL MEDIA AGENTS — Ads: Review Actions")
    print("=" * 60)

    from approvals.ads_queue import review_ads_queue
    review_ads_queue()


def cmd_ads_apply() -> None:
    """
    Apply all approved ad actions to the Meta Marketing API,
    then mark each as 'applied' in the queue.
    """
    print("\n" + "=" * 60)
    print("  SOCIAL MEDIA AGENTS — Ads: Apply Approved Actions")
    print("=" * 60)

    from approvals.ads_queue import load_ads_queue, save_ads_queue
    from agents.ads_manager import apply_action
    from datetime import datetime

    actions = load_ads_queue()
    approved = [a for a in actions if a.get("status") == "approved"]

    if not approved:
        print("\n[Ads] No approved actions to apply.")
        print("Run  python main.py ads-review  to approve actions first.")
        return

    print(f"\n[Ads] Applying {len(approved)} approved action(s)...\n")

    for action in actions:
        if action.get("status") != "approved":
            continue

        from approvals.ads_queue import ACTION_LABELS
        label = ACTION_LABELS.get(action["type"], action["type"])
        print(f"─ {label}: {action.get('target_name')}")

        try:
            result = apply_action(action)
            action["status"]     = "applied"
            action["applied_at"] = result["applied_at"]
            action["api_result"] = result.get("api_response", {})
            print(f"  ✓ Applied successfully.")
        except Exception as exc:
            print(f"  ✗ ERROR: {exc}")
            print(f"  Action remains 'approved' — fix the error and retry.")

    save_ads_queue(actions)
    applied_count = sum(1 for a in actions if a.get("status") == "applied")
    print(f"\n[Ads] Done. {applied_count} total action(s) applied.")


def print_usage() -> None:
    print(
        "\nUsage: python main.py <command>\n"
        "\nOrganic posts:\n"
        "  run          Prompt for a content goal and run the full agent pipeline\n"
        "  review       Interactively review the post approval queue (CLI)\n"
        "  post         Publish all approved posts to their platforms\n"
        "  dashboard    Launch the web approval dashboard at http://localhost:5000\n"
        "\nAds management:\n"
        "  ads-analyze  Audit active campaigns and queue optimization recommendations\n"
        "  ads-create   Design a new campaign with Claude and queue it for approval\n"
        "  ads-copy     Generate A/B ad copy variants (no API calls, ideation only)\n"
        "  ads-review   Interactively review pending ad actions (CLI)\n"
        "  ads-apply    Apply all approved ad actions to the Meta Marketing API\n"
    )


def main() -> None:
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "run":
        cmd_run()
    elif command == "review":
        cmd_review()
    elif command == "post":
        cmd_post()
    elif command == "dashboard":
        cmd_dashboard()
    elif command == "ads-analyze":
        cmd_ads_analyze()
    elif command == "ads-create":
        cmd_ads_create()
    elif command == "ads-copy":
        cmd_ads_copy()
    elif command == "ads-review":
        cmd_ads_review()
    elif command == "ads-apply":
        cmd_ads_apply()
    else:
        print(f"ERROR: Unknown command '{command}'")
        print_usage()
        sys.exit(1)


if __name__ == "__main__":
    main()
