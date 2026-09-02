"""Minimal Groq OpenAI-compatible client with safe deterministic fallback support."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
REASONING_MODEL = "openai/gpt-oss-120b"
FAST_MODEL = "openai/gpt-oss-20b"

logger = logging.getLogger("glassbox.groq")


def complete_json(*, model: str, system: str, user: str) -> dict[str, Any] | None:
    """Return a JSON object from Groq, or ``None`` when unavailable/invalid.

    No caller may treat a failed model request as permission to bypass a policy.
    Logs every call with timing and fallback detection so the local pipeline is
    observable — if this returns None, the caller must use deterministic fallback.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning(
            "[GROQ] ⚠️  GROQ_API_KEY not set — skipping LLM call (model=%s). "
            "Pipeline will run on deterministic fallback.",
            model,
        )
        return None

    candidate_models = [model]
    if model != "qwen/qwen3.6-27b":
        candidate_models.append("qwen/qwen3.6-27b")

    for current_model in candidate_models:
        body = json.dumps({
            "model": current_model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }).encode()

        request = Request(
            GROQ_ENDPOINT,
            data=body,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "GlassBox/1.0 (Windows NT 10.0; Win64; x64)",
            },
            method="POST",
        )

        for attempt in range(1, 3):
            t_start = time.perf_counter()
            try:
                with urlopen(request, timeout=15) as response:
                    raw = response.read().decode()
                elapsed = time.perf_counter() - t_start
                payload = json.loads(raw)
                result = json.loads(payload["choices"][0]["message"]["content"])
                logger.info(
                    "[GROQ] ✅ LLM call succeeded   model=%-32s  attempt=%d  elapsed=%.3fs",
                    current_model, attempt, elapsed,
                )
                return result
            except (KeyError, IndexError, TypeError, ValueError) as exc:
                elapsed = time.perf_counter() - t_start
                logger.warning(
                    "[GROQ] ⚠️  LLM response parse error  model=%s  attempt=%d  elapsed=%.3fs  error=%s",
                    current_model, attempt, elapsed, exc,
                )
                continue
            except (URLError, TimeoutError, OSError) as exc:
                elapsed = time.perf_counter() - t_start
                logger.warning(
                    "[GROQ] ❌ LLM network/timeout error  model=%s  attempt=%d  elapsed=%.3fs  error=%s",
                    current_model, attempt, elapsed, exc,
                )
                continue

    logger.error(
        "[GROQ] 🔴 All LLM attempts failed for model=%s — returning None. "
        "All callers will now use deterministic/regex fallback.",
        model,
    )
    return None
