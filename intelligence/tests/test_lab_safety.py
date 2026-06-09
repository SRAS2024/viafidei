"""Intelligence Lab — proof packets, logic rules, epistemic status (the safety core)."""

from __future__ import annotations

import unittest

from intelligence.operations import epistemic, logic_rules, proof


class TestProofPackets(unittest.TestCase):
    def test_well_supported_sensitive_claim_is_eligible(self):
        r = proof.prove_publish_eligibility({
            "content_type": "CHURCH_DOCUMENT",
            "evidence": {"sources": ["vatican.va", "usccb.org"], "authorities": ["VATICAN"],
                         "citations": ["c"], "agreements": 1},
        })["result"]
        self.assertTrue(r["eligible"])

    def test_conflict_blocks_publish(self):
        r = proof.build_proof_packet({
            "claim": {"text": "x", "contentType": "SAINT"},
            "evidence": {"sources": ["a"], "authorities": ["DIOCESAN"], "citations": ["c"],
                         "conflicts": ["date mismatch"]},
        })["result"]
        self.assertEqual(r["recommended_action"], "block")
        self.assertFalse(r["proven"])

    def test_weak_evidence_requires_review_not_autopublish(self):
        r = proof.prove_publish_eligibility({
            "content_type": "APPARITION",
            "evidence": {"sources": ["a"], "authorities": ["COMMUNITY"], "citations": []},
        })["result"]
        self.assertFalse(r["eligible"])


class TestLogicRules(unittest.TestCase):
    def test_duplicate_block_fails(self):
        r = logic_rules.evaluate_logic_rule({
            "rule_id": "duplicate_block", "state": {"duplicateScore": 0.95, "duplicateThreshold": 0.85},
        })["result"]
        self.assertFalse(r["ok"])

    def test_church_document_completeness(self):
        ok = logic_rules.check_invariants({"state": {
            "contentType": "CHURCH_DOCUMENT", "title": "t", "authority": "VATICAN",
            "documentType": "ENCYCLICAL", "citation": "c", "sourceUrl": "u", "route": "/r",
            "trustedSourceCount": 2,
        }})["result"]
        self.assertTrue(ok["all_pass"])
        bad = logic_rules.check_invariants({"state": {"contentType": "CHURCH_DOCUMENT", "title": "t"}})["result"]
        self.assertFalse(bad["all_pass"])

    def test_rule_conflict_block_wins(self):
        r = logic_rules.detect_rule_conflict({"state": {
            "duplicateScore": 0.95, "duplicateThreshold": 0.85,
        }})["result"]
        self.assertTrue(r["conflict"])
        self.assertEqual(r["resolution"], "block wins")


class TestEpistemic(unittest.TestCase):
    def test_vatican_claim_is_certain(self):
        r = epistemic.assign_epistemic_status({
            "claim": {"text": "x", "authority": "VATICAN", "citations": ["c"], "contentType": "SAINT"},
        })["result"]
        self.assertEqual(r["epistemic_status"], "CERTAIN")

    def test_conflict_blocks_sensitive(self):
        r = epistemic.assign_epistemic_status({
            "claim": {"text": "x", "authority": "VATICAN", "conflicts": ["c"], "contentType": "DOCTRINE"},
        })["result"]
        self.assertEqual(r["epistemic_status"], "BLOCKED")

    def test_overconfidence_detected(self):
        r = epistemic.detect_overconfidence({
            "claim": {"text": "x", "confidence": 0.95, "authority": "COMMUNITY"},
        })["result"]
        self.assertTrue(r["overconfident"])

    def test_rank_certainty_orders_vatican_first(self):
        r = epistemic.rank_claim_certainty({"claims": [
            {"text": "weak", "authority": "COMMUNITY"},
            {"text": "strong", "authority": "VATICAN", "citations": ["c"]},
        ]})["result"]
        self.assertEqual(r["most_certain"]["claim"], "strong")


if __name__ == "__main__":
    unittest.main()
