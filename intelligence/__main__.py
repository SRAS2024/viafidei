"""Enables ``python3 -m intelligence`` (delegates to intelligence.main)."""

from __future__ import annotations

import sys

from .main import main

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
