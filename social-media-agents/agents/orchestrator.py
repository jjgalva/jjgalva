"""
agents/orchestrator.py
Coordinates the full content pipeline:
  analytics → content creation → approval queue → memory storage.
"""

from agents.analytics import analyze_performance
from agents.content_creator import create_content
from approvals.queue import add_to_queue
from tools.memory import save_post


PLATFORMS_TO_POST = ["instagram", "facebook", "tiktok"]


def run(goal: str) -> list[dict]:
    """
    Execute the full social media management pipeline for a given goal.

    Steps:
      1. Analyze current performance to inform content strategy.
      2. Create a post for each platform based on analytics insights + goal.
      3. Add each post to the approval queue (status = 'pending').
      4. Save each post to vector memory for future context.

    Args:
        goal: A high-level content goal, e.g. "promote our summer sale".

    Returns:
        A list of post dicts that were added to the approval queue.
    """
    print("\n" + "=" * 60)
    print(f"[Orchestrator] Starting pipeline for goal: '{goal}'")
    print("=" * 60)

    # Step 1 — Analytics
    print("\n[Orchestrator] Step 1/4: Running analytics agent...")
    try:
        analysis = analyze_performance()
        recommended_topics = analysis.get("recommended_topics", [])
        growth_summary = analysis.get("growth_summary", "")
        optimal_times = analysis.get("optimal_posting_times", {})
        print(
            f"[Orchestrator] Analytics done. "
            f"Recommended topics: {recommended_topics}"
        )
    except Exception as exc:
        print(f"[Orchestrator] WARNING: Analytics failed ({exc}). Continuing without insights.")
        analysis = {}
        recommended_topics = []
        growth_summary = ""
        optimal_times = {}

    # Build a rich topic prompt from goal + analytics
    analytics_context = ""
    if recommended_topics:
        analytics_context = (
            f" Analytics recommend touching on: {', '.join(recommended_topics[:3])}."
        )
    if growth_summary:
        analytics_context += f" Overall strategy note: {growth_summary}"

    topic = goal + analytics_context

    # Step 2 — Content creation per platform
    print(f"\n[Orchestrator] Step 2/4: Creating content for {len(PLATFORMS_TO_POST)} platforms...")
    posts = []
    for platform in PLATFORMS_TO_POST:
        try:
            post = create_content(topic=topic, platform=platform)
            # Override best_time_to_post with analytics recommendation if available
            if platform in optimal_times:
                post["best_time_to_post"] = optimal_times[platform]
            posts.append(post)
        except Exception as exc:
            print(
                f"[Orchestrator] WARNING: Could not create content for '{platform}': {exc}"
            )

    print(f"[Orchestrator] Content created for {len(posts)} platform(s).")

    # Step 3 — Add to approval queue
    print(f"\n[Orchestrator] Step 3/4: Adding {len(posts)} post(s) to approval queue...")
    queued = []
    for post in posts:
        try:
            add_to_queue(post)
            queued.append(post)
            print(
                f"[Orchestrator]   → Queued {post['platform']} post "
                f"(time: {post.get('best_time_to_post', 'N/A')})"
            )
        except Exception as exc:
            print(
                f"[Orchestrator] WARNING: Could not queue post for "
                f"'{post.get('platform', '?')}': {exc}"
            )

    # Step 4 — Save to memory
    print(f"\n[Orchestrator] Step 4/4: Saving posts to vector memory...")
    for post in queued:
        try:
            caption = post.get("caption", "")
            hashtags = " ".join(post.get("hashtags", []))
            full_content = f"{caption} {hashtags}".strip()
            save_post(
                platform=post["platform"],
                content=full_content,
                performance={},  # no performance data yet — post is pending
            )
        except Exception as exc:
            print(
                f"[Orchestrator] WARNING: Could not save post to memory: {exc}"
            )

    print("\n" + "=" * 60)
    print(
        f"[Orchestrator] Pipeline complete. "
        f"{len(queued)} post(s) queued for review."
    )
    print("=" * 60)
    print("\nRun  python main.py review  to approve or reject posts.")

    return queued
