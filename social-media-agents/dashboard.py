"""
dashboard.py
Flask web dashboard for reviewing and approving social media posts.

Run with:
    python dashboard.py
Then open http://localhost:5000 in your browser.
"""

import os
import sys
from datetime import datetime

from flask import Flask, jsonify, render_template, request

# Allow imports from the project root (config, approvals, etc.)
sys.path.insert(0, os.path.dirname(__file__))

from approvals.queue import load_queue, save_queue

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _get_stats(posts: list[dict]) -> dict:
    statuses = [p.get("status", "unknown") for p in posts]
    return {
        "total": len(posts),
        "pending": statuses.count("pending"),
        "approved": statuses.count("approved"),
        "rejected": statuses.count("rejected"),
        "published": statuses.count("published"),
    }


# ---------------------------------------------------------------------------
# HTML route
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# REST API
# ---------------------------------------------------------------------------

@app.get("/api/posts")
def api_get_posts():
    """Return all posts with their index and computed stats."""
    posts = load_queue()
    # Attach the index so the frontend can reference it
    indexed = [{"_index": i, **p} for i, p in enumerate(posts)]
    return jsonify({"posts": indexed, "stats": _get_stats(posts)})


@app.post("/api/posts/<int:idx>/approve")
def api_approve(idx: int):
    posts = load_queue()
    if idx < 0 or idx >= len(posts):
        return jsonify({"error": "Post not found"}), 404

    posts[idx]["status"] = "approved"
    posts[idx]["reviewed_at"] = datetime.utcnow().isoformat()
    posts[idx].pop("rejection_reason", None)
    save_queue(posts)
    return jsonify({"ok": True, "stats": _get_stats(posts)})


@app.post("/api/posts/<int:idx>/reject")
def api_reject(idx: int):
    posts = load_queue()
    if idx < 0 or idx >= len(posts):
        return jsonify({"error": "Post not found"}), 404

    body = request.get_json(silent=True) or {}
    posts[idx]["status"] = "rejected"
    posts[idx]["reviewed_at"] = datetime.utcnow().isoformat()
    if body.get("reason"):
        posts[idx]["rejection_reason"] = body["reason"]
    save_queue(posts)
    return jsonify({"ok": True, "stats": _get_stats(posts)})


@app.post("/api/posts/<int:idx>/reset")
def api_reset(idx: int):
    """Reset an approved or rejected post back to pending."""
    posts = load_queue()
    if idx < 0 or idx >= len(posts):
        return jsonify({"error": "Post not found"}), 404

    posts[idx]["status"] = "pending"
    posts[idx].pop("reviewed_at", None)
    posts[idx].pop("rejection_reason", None)
    save_queue(posts)
    return jsonify({"ok": True, "stats": _get_stats(posts)})


@app.post("/api/posts/<int:idx>/edit")
def api_edit(idx: int):
    """Update caption and/or hashtags for a post."""
    posts = load_queue()
    if idx < 0 or idx >= len(posts):
        return jsonify({"error": "Post not found"}), 404

    body = request.get_json(silent=True) or {}

    if "caption" in body and isinstance(body["caption"], str):
        posts[idx]["caption"] = body["caption"].strip()

    if "hashtags" in body and isinstance(body["hashtags"], list):
        posts[idx]["hashtags"] = [h.lstrip("#").strip() for h in body["hashtags"] if h.strip()]

    if "best_time_to_post" in body and isinstance(body["best_time_to_post"], str):
        posts[idx]["best_time_to_post"] = body["best_time_to_post"].strip()

    posts[idx]["edited_at"] = datetime.utcnow().isoformat()
    save_queue(posts)
    return jsonify({"ok": True, "post": {"_index": idx, **posts[idx]}})


@app.post("/api/posts/<int:idx>/delete")
def api_delete(idx: int):
    """Permanently remove a post from the queue."""
    posts = load_queue()
    if idx < 0 or idx >= len(posts):
        return jsonify({"error": "Post not found"}), 404

    posts.pop(idx)
    save_queue(posts)
    return jsonify({"ok": True, "stats": _get_stats(posts)})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("DASHBOARD_PORT", 5000))
    print(f"\n[Dashboard] Starting on http://localhost:{port}")
    print("[Dashboard] Press Ctrl+C to stop.\n")
    app.run(debug=True, port=port)
