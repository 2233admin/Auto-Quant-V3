"""Portable launch of a user-provided shell command string.

Structured commands should use argv arrays. This module exists only for the
operator-supplied command string of the external researcher, which is
interpreted by the platform shell: ``cmd.exe /d /s /c`` on Windows and
``/bin/sh -lc`` elsewhere. The child gets its own process group so a timeout
can end the whole tree.
"""

from __future__ import annotations

import os
import signal
import subprocess
from pathlib import Path
from typing import Any, Mapping


def launch_shell_command(
    command: str,
    *,
    cwd: str | Path,
    env: Mapping[str, str],
) -> subprocess.Popen[str]:
    """Start ``command`` through the platform shell with piped text stdio."""
    options: dict[str, Any] = {}
    environment = dict(env)
    if os.name == "nt":
        shell = environment.get("COMSPEC") or os.environ.get("COMSPEC") or "cmd.exe"
        # One raw command line: list2cmdline would backslash-escape the quotes
        # that `cmd /s` strips. Python children also need UTF-8 stdio to read
        # the brief and write JSON the same way as on POSIX.
        args: str | list[str] = f'"{shell}" /d /s /c "{command}"'
        environment.setdefault("PYTHONUTF8", "1")
        options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | getattr(
            subprocess, "CREATE_NO_WINDOW", 0
        )
    else:
        args = ["/bin/sh", "-lc", command]
        options["start_new_session"] = True
    return subprocess.Popen(
        args,
        cwd=cwd,
        env=environment,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        **options,
    )


def kill_process_tree(process: subprocess.Popen[Any]) -> None:
    """Force-stop the child and every descendant; tolerate an already-gone tree."""
    if os.name == "nt":
        # taskkill /T walks the tree from the live root; on a loaded machine it can be slow.
        # Retry once before falling back, because process.kill() alone orphans the descendants.
        for timeout in (30, 60):
            try:
                subprocess.run(
                    ["taskkill", "/T", "/F", "/PID", str(process.pid)],
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                    timeout=timeout,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                break
            except subprocess.TimeoutExpired:
                continue
            except (OSError, subprocess.SubprocessError):
                break
        if process.poll() is None:
            try:
                process.kill()
            except OSError:
                pass
        return
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except (OSError, ProcessLookupError):
        pass
