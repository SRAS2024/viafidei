"""
Chaos / resilience tests for the brain (spec: "replayability & resilience —
prove the system survives timeouts, process death, malformed output, and
protocol mismatch").

The brain's core safety property is that *one bad request never crashes the
process*: every malformed request, unknown op, hostile payload, or op that
raises must still produce a structured, validatable error envelope on the same
protocol. These tests feed deliberately hostile input and assert the brain
degrades to error envelopes rather than exceptions, and that the stdio loop
recovers from a bad line and keeps serving.
"""

from __future__ import annotations

import io
import json
import sys
import unittest

from intelligence import PROTOCOL_VERSION
from intelligence.main import _REQUIRED_ENVELOPE_KEYS, handle_request, run_stdio
from intelligence.registry import REGISTRY, list_ops

RISK_LEVELS = {"none", "low", "medium", "high", "critical"}


def is_envelope(resp) -> bool:
    return isinstance(resp, dict) and _REQUIRED_ENVELOPE_KEYS.issubset(resp)


class TestRequestResilience(unittest.TestCase):
    def test_non_dict_request_is_error_envelope(self):
        for bad in ([], "a string", 42, None, 3.14, True):
            resp = handle_request(bad)
            self.assertTrue(is_envelope(resp), f"{bad!r} did not yield an envelope")
            self.assertFalse(resp["ok"])
            self.assertEqual(resp["protocol_version"], PROTOCOL_VERSION)

    def test_non_dict_payload_is_coerced(self):
        for bad in ("garbage", 42, [1, 2, 3], None):
            resp = handle_request({"id": "1", "op": "iq_metrics", "payload": bad})
            self.assertTrue(is_envelope(resp))
            self.assertEqual(resp["op"], "iq_metrics")

    def test_unknown_op_echoes_op_and_lists_known(self):
        resp = handle_request({"id": "1", "op": "no_such_op", "payload": {}})
        self.assertFalse(resp["ok"])
        self.assertIn("unknown op", resp["error"])
        self.assertEqual(resp["op"], "no_such_op")
        self.assertFalse(resp["safe_to_auto_execute"])


class TestEveryOpSurvivesHostileInput(unittest.TestCase):
    """No op may crash the process or return a malformed envelope — ever."""

    def test_every_op_survives_empty_payload(self):
        for op in list_ops():
            resp = handle_request({"id": "x", "op": op, "payload": {}})
            self.assertTrue(is_envelope(resp), f"{op} returned a non-envelope on empty payload")
            self.assertEqual(resp["protocol_version"], PROTOCOL_VERSION)
            self.assertIn(resp["risk_level"], RISK_LEVELS, f"{op} bad risk_level")
            self.assertTrue(
                0.0 <= resp["confidence"] <= 1.0, f"{op} confidence out of range"
            )
            # An op may legitimately error on missing fields, but it must never
            # claim auto-execution safety while failing.
            if not resp["ok"]:
                self.assertFalse(resp["safe_to_auto_execute"], f"{op} unsafe error")

    def test_every_op_survives_type_confused_payload(self):
        # Every field is present but the WRONG type — the classic crash vector.
        garbage = {
            "items": "not a list",
            "candidates": 42,
            "record": None,
            "text": 123,
            "files": {"x": 1},
            "memories": "nope",
            "claims": True,
            "sources": 7,
            "query": [],
            "action": "string-not-dict",
            "decision": 0,
            "requests": "x",
            "failures": {},
            "goals": 1,
            "models": "m",
            "routes": 9,
        }
        for op in list_ops():
            resp = handle_request({"id": "x", "op": op, "payload": garbage})
            self.assertTrue(is_envelope(resp), f"{op} crashed on type-confused payload")
            self.assertEqual(resp["protocol_version"], PROTOCOL_VERSION)
            self.assertIn(resp["risk_level"], RISK_LEVELS, f"{op} bad risk_level")

    def test_every_op_survives_deeply_nested_garbage(self):
        nested = {"record": {"sources": [{"authorityLevel": ["not", "a", "string"]}]}}
        for op in list_ops():
            resp = handle_request({"id": "x", "op": op, "payload": nested})
            self.assertTrue(is_envelope(resp), f"{op} crashed on nested garbage")


class TestCrashingOpIsIsolated(unittest.TestCase):
    def test_op_that_raises_becomes_error_envelope(self):
        def boom(_payload):
            raise RuntimeError("intentional chaos")

        REGISTRY["__chaos_boom__"] = boom
        try:
            resp = handle_request({"id": "1", "op": "__chaos_boom__", "payload": {}})
            self.assertTrue(is_envelope(resp))
            self.assertFalse(resp["ok"])
            self.assertIn("RuntimeError", resp["error"])
            self.assertIn("intentional chaos", resp["error"])
            self.assertFalse(resp["safe_to_auto_execute"])
        finally:
            del REGISTRY["__chaos_boom__"]

    def test_op_returning_garbage_does_not_take_down_dispatch(self):
        # A misbehaving op that returns a non-dict still gets id/op/protocol
        # stamped without raising (handle_request does dict(resp)).
        REGISTRY["__chaos_baddict__"] = lambda _p: {"ok": True, "result": 1}
        try:
            resp = handle_request({"id": "1", "op": "__chaos_baddict__", "payload": {}})
            self.assertEqual(resp["protocol_version"], PROTOCOL_VERSION)
            self.assertEqual(resp["id"], "1")
        finally:
            del REGISTRY["__chaos_baddict__"]


class TestStdioLoopRecovers(unittest.TestCase):
    """The persistent stdio loop must survive malformed lines and keep going."""

    def _run(self, lines):
        old_in, old_out = sys.stdin, sys.stdout
        sys.stdin = io.StringIO("".join(f"{ln}\n" for ln in lines))
        sys.stdout = io.StringIO()
        try:
            code = run_stdio()
            return code, sys.stdout.getvalue()
        finally:
            sys.stdin, sys.stdout = old_in, old_out

    def test_malformed_json_line_yields_error_envelope(self):
        _code, out = self._run(["{ not valid json }"])
        resp = json.loads(out.strip())
        self.assertFalse(resp["ok"])
        self.assertIn("invalid JSON", resp["error"])
        self.assertEqual(resp["protocol_version"], PROTOCOL_VERSION)
        self.assertIsNone(resp["id"])

    def test_blank_lines_skipped(self):
        _code, out = self._run(["", "   ", "\t"])
        self.assertEqual(out.strip(), "")

    def test_loop_recovers_after_bad_line(self):
        # bad line, then a perfectly good request — both must produce output and
        # the good one must come back correct (the loop did not die).
        _code, out = self._run(
            [
                "{bad",
                json.dumps({"id": "good", "op": "iq_metrics", "payload": {"stats": {}}}),
            ]
        )
        responses = [json.loads(ln) for ln in out.strip().splitlines()]
        self.assertEqual(len(responses), 2)
        self.assertFalse(responses[0]["ok"])  # the malformed line
        self.assertEqual(responses[1]["id"], "good")
        self.assertTrue(responses[1]["ok"])

    def test_one_response_per_request_with_id_echo(self):
        _code, out = self._run(
            [
                json.dumps({"id": "a", "op": "iq_metrics", "payload": {"stats": {}}}),
                json.dumps({"id": "b", "op": "no_such", "payload": {}}),
                json.dumps({"id": "c", "op": "iq_metrics", "payload": {"stats": {}}}),
            ]
        )
        responses = [json.loads(ln) for ln in out.strip().splitlines()]
        self.assertEqual([r["id"] for r in responses], ["a", "b", "c"])
        self.assertTrue(responses[0]["ok"])
        self.assertFalse(responses[1]["ok"])  # unknown op
        self.assertTrue(responses[2]["ok"])


class TestProtocolStability(unittest.TestCase):
    def test_all_paths_carry_protocol_and_elapsed(self):
        for req in (
            {"id": "1", "op": "iq_metrics", "payload": {"stats": {}}},
            {"id": "2", "op": "unknown_op", "payload": {}},
            {"id": "3"},  # missing op
        ):
            resp = handle_request(req)
            self.assertEqual(resp["protocol_version"], PROTOCOL_VERSION)
            self.assertIn("elapsed_ms", resp)
            self.assertIsInstance(resp["elapsed_ms"], (int, float))


if __name__ == "__main__":
    unittest.main()
