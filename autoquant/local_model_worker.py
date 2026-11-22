"""Loopback-only model requests, run by the parent with a hard deadline."""

import http.client
import json
import math
import re
import sys

MAX_BYTES = 1024 * 1024
MODEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*\Z")
DIGEST = re.compile(r"[0-9a-f]{64}\Z")
CLOUD = re.compile(r"(?:^|[._:-])cloud(?:$|[._:-])", re.IGNORECASE)


class WorkerError(Exception):
    pass


def local_metadata(value, stage):
    if isinstance(value, dict):
        for key, item in value.items():
            key = key.lower()
            if item and (
                key in ("remote", "cloud") or key.startswith(("remote_", "cloud_"))
            ):
                raise WorkerError(f"{stage}: remote model metadata is forbidden")
            local_metadata(item, stage)
    elif isinstance(value, list):
        for item in value:
            local_metadata(item, stage)


def request(method, path, payload, timeout):
    connection = http.client.HTTPConnection("127.0.0.1", 11434, timeout=timeout)
    try:
        body = (
            None
            if payload is None
            else json.dumps(payload, allow_nan=False).encode("utf-8")
        )
        connection.request(
            method, path, body=body, headers={"Content-Type": "application/json"}
        )
        response = connection.getresponse()
        if response.status != 200:
            raise WorkerError(f"{path}: HTTP {response.status}; redirects not allowed")
        raw = response.read(MAX_BYTES + 1)
    except (OSError, http.client.HTTPException):
        raise WorkerError(
            f"{path}: local Ollama connection or response failed"
        ) from None
    finally:
        connection.close()
    if len(raw) > MAX_BYTES:
        raise WorkerError(f"{path}: response exceeds 1 MiB")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise WorkerError(f"{path}: expected a JSON object")
    return value


def installed_digest(model, pin, timeout):
    tags = request("GET", "/api/tags", None, timeout).get("models")
    matches = [
        item for item in tags if isinstance(item, dict) and item.get("name") == model
    ]
    if len(matches) != 1:
        raise WorkerError("Requested local model tag is missing or ambiguous")
    installed = matches[0]
    local_metadata(installed, "model tags")
    digest = installed.get("digest")
    if (
        installed.get("model", model) != model
        or type(installed.get("size")) is not int
        or installed["size"] <= 0
        or not isinstance(digest, str)
        or not DIGEST.fullmatch(digest)
    ):
        raise WorkerError("Model tag must have local weights and a SHA-256 digest")
    if pin is not None and pin != digest:
        raise WorkerError("Local model digest does not match the plan")
    return digest


def complete(data):
    model, pin, timeout = data["model"], data["digest"], data["timeout"]
    if not isinstance(model, str) or not MODEL.fullmatch(model) or CLOUD.search(model):
        raise WorkerError(
            "Supply an explicit locally installed name:tag, not a cloud tag"
        )
    if type(timeout) not in (int, float) or not math.isfinite(timeout) or timeout <= 0:
        raise WorkerError("Specify a positive local model deadline")
    digest = installed_digest(model, pin, timeout)
    info = request("POST", "/api/show", {"model": model}, timeout)
    local_metadata(info, "model details")
    if "completion" not in info.get("capabilities", []):
        raise WorkerError("The local model must support text completion")
    messages = data["messages"]
    if data["format"] is not None:
        system, *remaining = messages
        schema_guide = json.dumps(data["format"], ensure_ascii=False)
        messages = [
            {
                **system,
                "content": f"{system['content']}\nReturn exactly one JSON object matching: {schema_guide}",
            },
            *remaining,
        ]
    response = request(
        "POST",
        "/api/chat",
        {
            "model": model,
            "messages": messages,
            "format": "json",
            "stream": False,
            "think": False,
            "keep_alive": "1m",
            "options": {"temperature": 0, "num_predict": 2400, "num_ctx": 8192},
        },
        timeout,
    )
    local_metadata(response, "model response")
    message = response.get("message", {})
    content = message.get("content")
    if (
        response.get("model") != model
        or response.get("done") is not True
        or response.get("done_reason") != "stop"
        or message.get("role") != "assistant"
        or response.get("tool_calls")
        or message.get("tool_calls")
        or not isinstance(content, str)
        or not content.strip()
    ):
        raise WorkerError(
            "Expected complete text from the exact local model without tool calls"
        )
    installed_digest(model, digest, timeout)
    return {"content": content, "modelDigest": digest}


def main():
    raw = sys.stdin.buffer.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise WorkerError("Model request exceeds 1 MiB")
    result = complete(json.loads(raw))
    sys.stdout.buffer.write(json.dumps(result).encode("utf-8"))


if __name__ == "__main__":
    try:
        main()
    except WorkerError as error:
        sys.stderr.write(f"{error}\n")
        sys.exit(1)
    except (ValueError, TypeError, KeyError, AttributeError, RecursionError):
        sys.stderr.write("Invalid local Ollama response or worker request\n")
        sys.exit(1)
