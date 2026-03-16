"""
approvals/queue.py
JSON-file-backed approval queue for social media posts.
"""

import json
import os
from datetime import datetime

from config import QUEUE_FILE


def load_queue() -> list[dict]:
    """Read the pending.json file and return all posts."""
    if not os.path.isfile(QUEUE_FILE):
        return []
    with open(QUEUE_FILE, "r", encoding="utf-8") as fh:
        try:
            return json.load(fh)
        except json.JSONDecodeError:
            print("[Queue] WARNING: pending.json is corrupted. Starting fresh.")
            return []


def save_queue(posts: list[dict]) -> None:
    """Write the full list of posts back to pending.json."""
    os.makedirs(os.path.dirname(QUEUE_FILE), exist_ok=True)
    with open(QUEUE_FILE, "w", encoding="utf-8") as fh:
        json.dump(posts, fh, indent=2, ensure_ascii=False)


def add_to_queue(post: dict) -> None:
    """
    Append a new post to the approval queue with status 'pending'.

    The post dict should contain at minimum:
        platform, caption, hashtags, suggested_visual, best_time_to_post
    """
    posts = load_queue()

    entry = {
        "platform": post.get("platform", "unknown"),
        "caption": post.get("caption", ""),
        "hashtags": post.get("hashtags", []),
        "suggested_visual": post.get("suggested_visual", ""),
        "best_time_to_post": post.get("best_time_to_post", "09:00"),
        "status": "pending",
        "queued_at": datetime.utcnow().isoformat(),
    }

    posts.append(entry)
    save_queue(posts)
    print(f"[Queue] Post added to approval queue (platform={entry['platform']}).")


def review_queue() -> None:
    """
    Interactive CLI loop for reviewing pending posts.

    For each pending post the reviewer can:
        y  — approve
        n  — reject
        e  — edit the caption inline
        s  — skip (leave as pending)
        q  — quit the review session
    """
    posts = load_queue()
    pending = [p for p in posts if p.get("status") == "pending"]

    if not pending:
        print("\n[Queue] No pending posts to review. All caught up!")
        return

    print(f"\n[Queue] {len(pending)} post(s) pending review.\n")

    changed = False

    for post in posts:
        if post.get("status") != "pending":
            continue

        print("─" * 60)
        print(f"PLATFORM      : {post['platform'].upper()}")
        print(f"BEST TIME     : {post.get('best_time_to_post', 'N/A')}")
        print(f"SUGGESTED VIS : {post.get('suggested_visual', 'N/A')}")
        print(f"HASHTAGS      : {' '.join(post.get('hashtags', []))}")
        print(f"\nCAPTION:\n{post.get('caption', '')}")
        print("─" * 60)

        while True:
            choice = input(
                "\n[y] Approve  [n] Reject  [e] Edit caption  [s] Skip  [q] Quit\n> "
            ).strip().lower()

            if choice == "y":
                post["status"] = "approved"
                post["reviewed_at"] = datetime.utcnow().isoformat()
                print(f"✓ Approved — {post['platform']} post.")
                changed = True
                break

            elif choice == "n":
                post["status"] = "rejected"
                post["reviewed_at"] = datetime.utcnow().isoformat()
                reason = input("Rejection reason (optional): ").strip()
                if reason:
                    post["rejection_reason"] = reason
                print(f"✗ Rejected — {post['platform']} post.")
                changed = True
                break

            elif choice == "e":
                print("\nCurrent caption:")
                print(post.get("caption", ""))
                print("\nEnter new caption (press Enter twice when done):")
                lines = []
                while True:
                    line = input()
                    if line == "" and lines and lines[-1] == "":
                        break
                    lines.append(line)
                new_caption = "\n".join(lines).strip()
                if new_caption:
                    post["caption"] = new_caption
                    print("✏ Caption updated.")
                    changed = True
                else:
                    print("(No changes made.)")
                # Loop back to show options again

            elif choice == "s":
                print(f"→ Skipped — {post['platform']} post remains pending.")
                break

            elif choice == "q":
                print("\n[Queue] Exiting review session.")
                if changed:
                    save_queue(posts)
                    print("[Queue] Changes saved.")
                return

            else:
                print("Invalid choice. Please enter y, n, e, s, or q.")

    if changed:
        save_queue(posts)
        print("\n[Queue] All changes saved to pending.json.")

    # Summary
    updated = load_queue()
    approved = sum(1 for p in updated if p.get("status") == "approved")
    rejected = sum(1 for p in updated if p.get("status") == "rejected")
    still_pending = sum(1 for p in updated if p.get("status") == "pending")
    print(
        f"\n[Queue] Review session complete. "
        f"Approved: {approved} | Rejected: {rejected} | Still pending: {still_pending}"
    )
    print("Run  python main.py post  to publish approved posts.")
