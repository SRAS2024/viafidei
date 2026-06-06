"""Tests for the stdio dispatch protocol (intelligence.main)."""

from __future__ import annotations

import unittest

from intelligence import PROTOCOL_VERSION
from intelligence.main import _REQUIRED_ENVELOPE_KEYS, _SELFTEST_CASES, handle_request
from intelligence.registry import list_ops


class TestProtocol(unittest.TestCase):
    def test_unknown_op_returns_error_envelope(self):
        resp = handle_request({"id": "1", "op": "does_not_exist", "payload": {}})
        self.assertFalse(resp["ok"])
        self.assertIsNotNone(resp["error"])
        self.assertFalse(resp["safe_to_auto_execute"])
        self.assertEqual(resp["protocol_version"], PROTOCOL_VERSION)

    def test_missing_op_returns_error(self):
        resp = handle_request({"id": "1", "payload": {}})
        self.assertFalse(resp["ok"])

    def test_missing_required_payload_field_is_handled(self):
        # detect_duplicates needs 'target' + 'candidates'; omit both.
        resp = handle_request({"op": "detect_duplicates", "payload": {}})
        self.assertFalse(resp["ok"])
        self.assertIn("required", (resp["error"] or "").lower())

    def test_non_dict_payload_is_tolerated(self):
        resp = handle_request({"op": "embed", "payload": "not-a-dict"})
        # embed requires 'items'; with a coerced empty dict it fails cleanly.
        self.assertIn("ok", resp)
        self.assertEqual(resp["op"], "embed")

    def test_every_op_has_a_selftest_case(self):
        self.assertEqual(set(list_ops()), set(_SELFTEST_CASES))

    def test_all_ops_produce_valid_envelopes(self):
        for op in list_ops():
            resp = handle_request({"id": "t", "op": op, "payload": _SELFTEST_CASES[op]})
            missing = _REQUIRED_ENVELOPE_KEYS - set(resp)
            self.assertEqual(missing, set(), f"{op} missing keys: {missing}")
            self.assertTrue(resp["ok"], f"{op} not ok: {resp.get('error')}")
            self.assertTrue(0.0 <= resp["confidence"] <= 1.0, f"{op} confidence out of range")
            self.assertIn(resp["risk_level"], {"none", "low", "medium", "high", "critical"})
            self.assertIn("elapsed_ms", resp)


if __name__ == "__main__":
    unittest.main()
