"""Lets the tests import the engine's modules (latin, normalize, qa, ...) by name."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
