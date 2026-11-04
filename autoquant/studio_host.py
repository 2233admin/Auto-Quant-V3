"""Host contract for a supervisor (OpenAlice) that launches Studio.

The supervisor injects ``HARNESS_CAPABILITY``, ``HARNESS_HOST``,
``HARNESS_PORTS`` and ``HARNESS_NO_OPEN``. When ``HARNESS_CAPABILITY`` is
exactly ``studio`` Studio is *hosted*: it binds the injected entry port, never
falls back to the standalone default and never opens a browser. Any other value
(or no value) leaves standalone behaviour untouched.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Mapping

from .workspace import AutoQuantValidationError, ValidationIssue

HOST_CAPABILITY = "studio"
ENTRY_PORT = "http"
DEFAULT_BIND_HOST = "127.0.0.1"
HOST_KIND = "openalice"
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})


@dataclass(frozen=True)
class HostContract:
    host: str
    port: int

    def snapshot_block(self) -> dict[str, str]:
        return {"kind": HOST_KIND, "capability": HOST_CAPABILITY}


def _fail(message: str) -> AutoQuantValidationError:
    return AutoQuantValidationError(
        [ValidationIssue("HARNESS_*", "studio.host-contract", message)]
    )


def resolve_host_contract(
    environ: Mapping[str, str] | None = None,
) -> HostContract | None:
    """Return the hosted-mode contract, or None when running standalone.

    Raises AutoQuantValidationError when hosted mode is requested but the
    injected values are missing or invalid.
    """
    env = os.environ if environ is None else environ
    if env.get("HARNESS_CAPABILITY") != HOST_CAPABILITY:
        return None
    raw_ports = env.get("HARNESS_PORTS")
    if not raw_ports:
        raise _fail(
            "HARNESS_CAPABILITY=studio requires HARNESS_PORTS, "
            f'a JSON object such as {{"{ENTRY_PORT}":49321}}'
        )
    try:
        ports = json.loads(raw_ports)
    except ValueError as error:
        raise _fail(f"HARNESS_PORTS is not valid JSON: {error}") from None
    if not isinstance(ports, dict):
        raise _fail("HARNESS_PORTS must be a JSON object mapping port names to numbers")
    port = ports.get(ENTRY_PORT)
    if port is None:
        raise _fail(f'HARNESS_PORTS has no "{ENTRY_PORT}" entry port')
    if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
        raise _fail(
            f'HARNESS_PORTS "{ENTRY_PORT}" must be an integer from 1 to 65535, got {port!r}'
        )
    host = env.get("HARNESS_HOST") or DEFAULT_BIND_HOST
    if host not in LOOPBACK_HOSTS:
        raise _fail(f"HARNESS_HOST must be a loopback address, got {host!r}")
    return HostContract(host=host, port=port)
