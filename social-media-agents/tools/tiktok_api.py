"""
tools/tiktok_api.py
Wrappers for the TikTok Content Posting API v2.
"""

import os
import requests
from config import PLATFORMS


def _api_base() -> str:
    return PLATFORMS["tiktok"]["api_base"]


def _headers() -> dict:
    token = PLATFORMS["tiktok"]["access_token"]
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=UTF-8",
    }


def upload_tiktok_video(video_path: str, caption: str) -> str:
    """
    Upload a local video file to TikTok in three steps:
      1. Initialize the upload (get upload_url + publish_id).
      2. Upload the video bytes via PUT.
      3. Return the publish_id for status polling.

    Returns the publish_id string, or raises on error.
    """
    open_id = PLATFORMS["tiktok"]["open_id"]
    base = _api_base()

    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    file_size = os.path.getsize(video_path)
    print(
        f"[TikTok API] Initializing video upload for '{video_path}' "
        f"({file_size} bytes)..."
    )

    # Step 1 — initialize upload
    try:
        init_resp = requests.post(
            f"{base}/post/publish/video/init/",
            headers=_headers(),
            json={
                "post_info": {
                    "title": caption[:150],  # TikTok title max 150 chars
                    "privacy_level": "SELF_ONLY",  # safe default; change as needed
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False,
                },
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": file_size,
                    "chunk_size": file_size,
                    "total_chunk_count": 1,
                },
            },
            timeout=30,
        )
        init_resp.raise_for_status()
        init_data = init_resp.json()

        if init_data.get("error", {}).get("code", "ok") != "ok":
            raise RuntimeError(
                f"TikTok init error: {init_data.get('error')}"
            )

        upload_url = init_data["data"]["upload_url"]
        publish_id = init_data["data"]["publish_id"]
        print(f"[TikTok API] Upload initialized. Publish ID: {publish_id}")

        # Step 2 — upload bytes
        print(f"[TikTok API] Uploading video bytes...")
        with open(video_path, "rb") as fh:
            video_bytes = fh.read()

        upload_resp = requests.put(
            upload_url,
            headers={
                "Content-Type": "video/mp4",
                "Content-Range": f"bytes 0-{file_size - 1}/{file_size}",
                "Content-Length": str(file_size),
            },
            data=video_bytes,
            timeout=120,
        )
        upload_resp.raise_for_status()
        print(f"[TikTok API] Video bytes uploaded successfully.")

        return publish_id

    except requests.RequestException as exc:
        print(f"[TikTok API] HTTP error uploading video: {exc}")
        raise


def get_tiktok_video_stats(publish_id: str) -> dict:
    """
    Fetch the publish status of a TikTok video upload.

    Returns a dict with publish status and any available stats.
    Possible status values: 'PROCESSING_UPLOAD', 'PUBLISH_COMPLETE', 'FAILED', etc.
    """
    base = _api_base()
    print(f"[TikTok API] Fetching publish status for publish_id: {publish_id}...")

    try:
        resp = requests.post(
            f"{base}/post/publish/status/fetch/",
            headers=_headers(),
            json={"publish_id": publish_id},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("error", {}).get("code", "ok") != "ok":
            raise RuntimeError(
                f"TikTok status fetch error: {data.get('error')}"
            )

        status_info = data.get("data", {})
        print(
            f"[TikTok API] Publish status: {status_info.get('status', 'unknown')}"
        )
        return status_info

    except requests.RequestException as exc:
        print(f"[TikTok API] HTTP error fetching video stats: {exc}")
        raise
