import os
from dotenv import load_dotenv

load_dotenv()

# --- Brand voice used in all AI prompts ---
BRAND_VOICE = (
    "We are a friendly, professional, and innovative brand. "
    "Our tone is conversational yet authoritative. We inspire our audience with "
    "authentic storytelling, practical value, and a dash of wit. We avoid jargon, "
    "embrace inclusivity, and always invite engagement. We speak in first-person plural "
    "('we', 'our') and sign off with energy and optimism."
)

# --- Platform credentials and config ---
PLATFORMS = {
    "instagram": {
        "access_token": os.getenv("INSTAGRAM_ACCESS_TOKEN", ""),
        "account_id": os.getenv("INSTAGRAM_ACCOUNT_ID", ""),
        "graph_api_version": "v19.0",
        "graph_api_base": "https://graph.facebook.com",
    },
    "facebook": {
        "access_token": os.getenv("FACEBOOK_ACCESS_TOKEN", ""),
        "page_id": os.getenv("FACEBOOK_PAGE_ID", ""),
        "graph_api_version": "v19.0",
        "graph_api_base": "https://graph.facebook.com",
    },
    "tiktok": {
        "access_token": os.getenv("TIKTOK_ACCESS_TOKEN", ""),
        "open_id": os.getenv("TIKTOK_OPEN_ID", ""),
        "api_base": "https://open.tiktokapis.com/v2",
    },
}

# --- Meta Ads ---
META_AD_ACCOUNT_ID = os.getenv("META_AD_ACCOUNT_ID", "")  # numeric, without "act_" prefix

# --- Anthropic ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = "claude-sonnet-4-20250514"

# --- Approval queue file path ---
QUEUE_FILE = os.path.join(os.path.dirname(__file__), "approvals", "pending.json")

# --- ChromaDB persistence directory ---
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), ".chromadb")
