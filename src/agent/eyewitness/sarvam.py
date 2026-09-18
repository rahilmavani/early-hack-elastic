import httpx

from eyewitness.config import get_settings

TRANSLATE_URL = "https://api.sarvam.ai/translate"
LANGUAGES = {"hi-IN": "Hindi", "ta-IN": "Tamil"}


def translate(text: str, target: str) -> str | None:
    """Translate an incident summary for regional on-call teams. Returns None when unconfigured."""
    settings = get_settings()
    if not settings.sarvam_api_key:
        return None
    response = httpx.post(
        TRANSLATE_URL,
        headers={"api-subscription-key": settings.sarvam_api_key},
        json={
            "input": text,
            "source_language_code": "en-IN",
            "target_language_code": target,
            "model": "sarvam-translate:v1",
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("translated_text")


def translations(text: str) -> dict[str, str]:
    result = {}
    for code, name in LANGUAGES.items():
        translated = translate(text, code)
        if translated:
            result[name] = translated
    return result
