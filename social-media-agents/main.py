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


def print_usage() -> None:
    print(
        "\nUsage: python main.py <command>\n"
        "\nCommands:\n"
        "  run        Prompt for a content goal and run the full agent pipeline\n"
        "  review     Interactively review the approval queue (CLI)\n"
        "  post       Publish all approved posts to their platforms\n"
        "  dashboard  Launch the web approval dashboard at http://localhost:5000\n"
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
    else:
        print(f"ERROR: Unknown command '{command}'")
        print_usage()
        sys.exit(1)


if __name__ == "__main__":
    main()
