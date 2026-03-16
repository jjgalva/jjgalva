"""
tools/memory.py
Vector memory using ChromaDB for storing and retrieving social media posts.
"""

import json
import uuid
from datetime import datetime

import chromadb
from chromadb.utils import embedding_functions

from config import CHROMA_PERSIST_DIR


def _get_collection():
    """Return (or create) the persistent ChromaDB collection."""
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    ef = embedding_functions.DefaultEmbeddingFunction()
    collection = client.get_or_create_collection(
        name="social_media_posts",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )
    return collection


def save_post(platform: str, content: str, performance: dict = None) -> str:
    """
    Store a post in ChromaDB with its metadata.

    Args:
        platform:    'instagram' | 'facebook' | 'tiktok'
        content:     The caption / post text.
        performance: Optional dict of engagement metrics, e.g.
                     {'likes': 120, 'comments': 14, 'shares': 5, 'reach': 3400}

    Returns:
        The generated document ID.
    """
    if performance is None:
        performance = {}

    doc_id = str(uuid.uuid4())
    metadata = {
        "platform": platform,
        "created_at": datetime.utcnow().isoformat(),
        "likes": int(performance.get("likes", 0)),
        "comments": int(performance.get("comments", 0)),
        "shares": int(performance.get("shares", 0)),
        "reach": int(performance.get("reach", 0)),
        "engagement_score": (
            int(performance.get("likes", 0))
            + int(performance.get("comments", 0)) * 2
            + int(performance.get("shares", 0)) * 3
        ),
        "performance_json": json.dumps(performance),
    }

    collection = _get_collection()
    collection.add(
        ids=[doc_id],
        documents=[content],
        metadatas=[metadata],
    )
    print(f"[Memory] Saved post to ChromaDB (id={doc_id}, platform={platform}).")
    return doc_id


def get_similar_posts(query: str, n: int = 5) -> list[dict]:
    """
    Semantic search — return the n posts most similar to `query`.

    Returns a list of dicts: {'content': str, 'platform': str, 'metadata': dict}
    """
    collection = _get_collection()

    try:
        results = collection.query(
            query_texts=[query],
            n_results=min(n, collection.count() or 1),
            include=["documents", "metadatas", "distances"],
        )
    except Exception as exc:
        print(f"[Memory] Warning: could not query similar posts: {exc}")
        return []

    posts = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        posts.append(
            {
                "content": doc,
                "platform": meta.get("platform", "unknown"),
                "similarity": round(1 - dist, 4),
                "metadata": meta,
            }
        )

    print(f"[Memory] Found {len(posts)} similar post(s) for query.")
    return posts


def get_top_performing(platform: str, n: int = 3) -> list[dict]:
    """
    Return the top-n posts (by engagement_score) for a given platform.

    Returns a list of dicts: {'content': str, 'engagement_score': int, 'metadata': dict}
    """
    collection = _get_collection()

    if collection.count() == 0:
        print(f"[Memory] No posts in memory yet for platform '{platform}'.")
        return []

    try:
        results = collection.get(
            where={"platform": platform},
            include=["documents", "metadatas"],
        )
    except Exception as exc:
        print(f"[Memory] Warning: could not fetch top performing posts: {exc}")
        return []

    if not results["documents"]:
        print(f"[Memory] No posts stored for platform '{platform}'.")
        return []

    posts = [
        {
            "content": doc,
            "engagement_score": meta.get("engagement_score", 0),
            "metadata": meta,
        }
        for doc, meta in zip(results["documents"], results["metadatas"])
    ]

    # Sort descending by engagement_score and take top n
    posts.sort(key=lambda p: p["engagement_score"], reverse=True)
    top = posts[:n]
    print(
        f"[Memory] Returning top {len(top)} post(s) for '{platform}' "
        f"(max engagement score: {top[0]['engagement_score'] if top else 0})."
    )
    return top
