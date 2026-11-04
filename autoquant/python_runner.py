"""Run a Python command with the interpreter that owns the AutoQuant install."""

from __future__ import annotations

import subprocess
import sys
from collections.abc import Sequence


def interpreter_command(arguments: Sequence[str]) -> list[str]:
    """Return the exact Python command owned by the installed Harness."""

    return [sys.executable, *arguments]


def main(argv: Sequence[str] | None = None) -> int:
    """Run the owning Python interpreter and return its exit code.

    ``os.execv`` on Windows re-joins the argv without quoting, which splits
    any argument that contains a space; an argv-list subprocess keeps each
    argument intact.
    """

    arguments = list(argv if argv is not None else sys.argv[1:])
    if not arguments:
        print(
            "usage: aq-python <python-script-or-option> [arguments ...]",
            file=sys.stderr,
        )
        return 2
    command = interpreter_command(arguments)
    try:
        return subprocess.run(command, check=False).returncode
    except KeyboardInterrupt:
        return 130
