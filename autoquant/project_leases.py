"""Crash-released local file leases shared by Studio and candidate writers."""
from __future__ import annotations

import os
import stat
from pathlib import Path


class LeaseBusy(OSError):
    pass


def _confine(path: Path, root: Path) -> None:
    if not path.is_absolute() or not path.is_relative_to(root):
        raise OSError("Lease path escaped its root")
    parts = [root, *(root / parent for parent in reversed(path.relative_to(root).parents)),
             path]
    for part in parts:
        if part.exists() or part.is_symlink():
            info = part.lstat()
            if stat.S_ISLNK(info.st_mode) or (
                getattr(info, "st_file_attributes", 0) &
                getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
            ):
                raise OSError("Lease paths cannot use links or reparse points")


class FileLease:
    def __init__(self, stream):
        self.stream = stream

    def close(self):
        stream, self.stream = self.stream, None
        if stream is None:
            return
        try:
            stream.seek(0)
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
        finally:
            stream.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def acquire_file_lease(path: Path, root: Path) -> FileLease:
    """Never unlink a lock file: the kernel owns lease lifetime on crashes."""
    path, root = path.absolute(), root.absolute()
    _confine(path, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    _confine(path, root)
    stream = path.open("a+b")
    try:
        if stream.seek(0, 2) == 0:
            stream.write(b"0")
            stream.flush()
        stream.seek(0)
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except (OSError, IOError) as error:
        stream.close()
        raise LeaseBusy("Resource is already owned by another process") from error
    return FileLease(stream)
