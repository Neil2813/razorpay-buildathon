"""Minimal Groq OpenAI-compatible client with safe deterministic fallback support."""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
REASONING_MODEL = "llama-3.3-70b-versatile"
FAST_MODEL = "llama-3.1-8b-instant"


def complete_json(*, model: str, system: str, user: str) -> dict[str, Any] | None:
    """Return a JSON object from Groq, or ``None`` when unavailable/invalid.

    No caller may treat a failed model request as permission to bypass a policy.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    body = json.dumps({"model": model, "temperature": 0, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}).encode()
    request = Request(GROQ_ENDPOINT, data=body, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=6) as response:
            payload = json.loads(response.read().decode())
        return json.loads(payload["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError, ValueError, URLError, TimeoutError):
        return None
