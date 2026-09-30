"""Export visible conversation and tool calls without private agent instructions."""

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

source = Path(sys.argv[1])
destination = Path(__file__).resolve().parents[1] / "docs" / "ai"
destination.mkdir(parents=True, exist_ok=True)
rows = [json.loads(line) for line in source.read_text().splitlines() if line.strip()]
now = datetime.now(UTC).isoformat()
messages = [
    "# Exercise conversation export",
    f"\nSnapshot: {now}\n",
    "Actual visible user/assistant messages from the active exercise session. "
    "Internal instructions, reasoning, and machine tool results are omitted. "
    "The initial user message contains their pasted earlier conversation.\n",
]
calls = []
models = set()
for row in rows:
    payload = row.get("payload", {})
    if row.get("type") == "turn_context" and payload.get("model"):
        models.add(payload["model"])
    if row.get("type") != "response_item":
        continue
    if payload.get("type") in ("function_call", "custom_tool_call"):
        calls.append({
            "timestamp": row.get("timestamp"),
            "name": payload.get("name"),
            "arguments": payload.get("arguments", payload.get("input")),
        })
        continue
    if payload.get("type") != "message":
        continue
    role = payload.get("role")
    if role not in ("user", "assistant"):
        continue
    phase = payload.get("channel", payload.get("phase"))
    if role == "assistant" and phase not in ("commentary", "final", "final_answer"):
        continue
    text = "\n".join(part.get("text", "") for part in payload.get("content", []))
    if not text or text.startswith("<environment_context>"):
        continue
    messages.append(f"## {role.title()} — {row.get('timestamp', '')}\n\n{text}\n")
(destination / "conversation.md").write_text("\n".join(messages))
(destination / "tool-calls.jsonl").write_text(
    "\n".join(json.dumps(call, ensure_ascii=False) for call in calls) + "\n"
)
(destination / "export-metadata.json").write_text(json.dumps({
    "snapshot_utc": now,
    "models": sorted(models),
    "source_session": source.name,
    "exported_tool_calls": len(calls),
}, indent=2) + "\n")
print(f"Exported visible conversation and {len(calls)} tool calls to {destination}")
