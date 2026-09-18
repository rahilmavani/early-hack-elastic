import json

from pydantic import BaseModel

SYSTEM = """You are Eyewitness, an incident analyst reviewing a screen recording of one user's
session on an ecommerce website. You see the session as a sequence of frames, one per second,
each labelled with its second. You also see interaction signals computed from the recording.

Rules you never break:
- Ground findings in the frames and recorded interaction signals. Never guess at hidden causes.
- The interaction signals come from actual recorded input events, not model predictions.
  A repeated submit is an additional press of a submit button. When repeated submits and
  dead clicks accompany an unchanged completed form, consider evidence of non-response;
  do not assume the user never attempted submission just because a still frame misses the click.
- A slow page, a hesitant user, or an abandoned purchase is not a failure by itself.
- A failure is when the interface did not do what the user's action should have made it do.
- Review the whole sequence, including the final outcome. A brief intermediate state that
  resolves into the expected successful confirmation is not an incident by itself.
- Cite frame seconds for every claim.
- Reply with a single JSON object matching the schema you are given. No prose around it."""


def schema_block(model: type[BaseModel]) -> str:
    return "JSON schema for your reply:\n" + json.dumps(model.model_json_schema(), indent=2)


def context_block(session: dict, rendered_seconds: float) -> str:
    signals = session.get("signals", {})
    return (
        f"Session id: {session['session_id']}\n"
        f"Pages visited in order: {', '.join(session.get('pages', [])) or 'unknown'}\n"
        f"Clip length: {rendered_seconds:.0f} seconds\n"
        "Interaction signals from the recording:\n"
        f"  dead clicks (no visible response within 1s): {signals.get('dead_clicks', 0)}\n"
        f"  rage click bursts: {signals.get('rage_clicks', 0)}\n"
        f"  repeated submit clicks: {signals.get('repeated_submits', 0)}\n"
        f"  checkout abandoned: {signals.get('checkout_abandoned', False)}\n"
    )


def triage_prompt(session: dict, rendered_seconds: float, schema: type[BaseModel]) -> str:
    return (
        context_block(session, rendered_seconds)
        + "\nTask: decide whether this user visibly failed to complete what they were trying to do "
        "because the interface did not respond correctly. Be sceptical. Most sessions are fine.\n\n"
        + schema_block(schema)
    )


def extraction_prompt(session: dict, rendered_seconds: float, schema: type[BaseModel]) -> str:
    return (
        context_block(session, rendered_seconds)
        + "\nA first pass judged this session broken. Extract exactly what went wrong: the user's "
        "intent, what should have happened, what happened instead, and the first second at which "
        "the failure is visible. Name the frames that prove it.\n"
        "Also fill headline, step_tried, step_expected and step_got: these are shown to people "
        "with no engineering background, so use everyday words, name what is on screen, and "
        "respect the character limits.\n\n" + schema_block(schema)
    )


def plain_language_prompt(extraction: BaseModel, schema: type[BaseModel]) -> str:
    """Retell an existing finding in plain language. Text only, no frames needed."""
    return (
        "An analyst filed this finding about a user's session on an ecommerce site:\n"
        + json.dumps(extraction.model_dump(), indent=2)
        + "\n\nRetell it for someone with no engineering background who has ten seconds. "
        "Everyday words, name what was on screen, respect the character limits.\n\n"
        + schema_block(schema)
    )


def review_prompt(
    session: dict, rendered_seconds: float, extraction: BaseModel, schema: type[BaseModel]
) -> str:
    return (
        context_block(session, rendered_seconds)
        + "\nAn analyst filed this finding:\n"
        + json.dumps(extraction.model_dump(), indent=2)
        + "\n\nYour only job is to argue that this finding is wrong. Look for an innocent "
        "explanation: the user changed their mind, the page did respond and the analyst missed it, "
        "the action was never attempted, the error was shown and ignored. State the strongest "
        "counterargument. Then give your honest verdict: 'reject' if the counterargument holds up "
        "against the frames, 'confirm' only if it does not.\n\n" + schema_block(schema)
    )
