"""
Golden-set tests for the liturgical-calendar + lectionary brain operations.

Assertions are externally verifiable facts (moveable feasts are pure Easter
arithmetic; fixed anchors are published dates), so they prove the brain
reproduces the real General Roman Calendar — and stays in step with the
TypeScript engine via the shared lectionaryKey.
"""

from __future__ import annotations

import unittest
from datetime import date

from intelligence.operations import lectionary


def key(iso: str) -> str:
    return lectionary.resolve_day(date.fromisoformat(iso))["lectionaryKey"]


class TestLiturgicalCalendar(unittest.TestCase):
    def test_easter_computus(self):
        self.assertEqual(lectionary.easter_sunday(2025), date(2025, 4, 20))
        self.assertEqual(lectionary.easter_sunday(2026), date(2026, 4, 5))

    def test_easter_anchored_solemnities_2025(self):
        self.assertEqual(key("2025-04-13"), "palm-sunday")
        self.assertEqual(key("2025-04-17"), "holy-thursday")
        self.assertEqual(key("2025-04-18"), "good-friday")
        self.assertEqual(key("2025-04-20"), "easter-sunday")
        self.assertEqual(key("2025-04-27"), "easter-2-sunday")  # Divine Mercy
        self.assertEqual(key("2025-05-29"), "ascension")  # Easter + 39
        self.assertEqual(key("2025-06-08"), "pentecost")  # Easter + 49
        self.assertEqual(key("2025-06-15"), "trinity-sunday")
        self.assertEqual(key("2025-06-19"), "corpus-christi")

    def test_advent_christmas_and_ordinary_numbering(self):
        self.assertEqual(key("2024-11-24"), "christ-the-king")
        self.assertEqual(key("2024-12-01"), "advent-1-sunday")
        self.assertEqual(key("2025-12-17"), "advent-weekday-1217")
        self.assertEqual(key("2024-12-25"), "nativity")
        self.assertEqual(key("2025-01-01"), "mary-mother-of-god")
        self.assertEqual(key("2025-01-12"), "baptism-of-the-lord")
        self.assertEqual(key("2025-01-19"), "ordinary-2-sunday")

    def test_sanctoral_overlay_and_precedence(self):
        self.assertEqual(key("2025-08-15"), "assumption")
        self.assertEqual(key("2025-11-01"), "all-saints")
        self.assertEqual(key("2025-12-08"), "immaculate-conception")
        # 8 Dec 2024 is the 2nd Sunday of Advent → the feast transfers.
        self.assertEqual(key("2024-12-08"), "advent-2-sunday")

    def test_cycle_letters(self):
        d = lectionary.resolve_day(date(2025, 1, 19))
        self.assertEqual(d["sundayCycle"], "C")
        self.assertEqual(d["weekdayCycle"], "I")


class TestLectionaryOps(unittest.TestCase):
    def test_liturgical_day_envelope(self):
        r = lectionary.liturgical_day({"date": "2026-04-05"})
        self.assertTrue(r["ok"])
        self.assertEqual(r["result"]["lectionaryKey"], "easter-sunday")
        self.assertEqual(r["result"]["color"], "White")
        self.assertTrue(r["safe_to_auto_execute"])

    def test_lectionary_readings_covered(self):
        r = lectionary.lectionary_readings({"date": "2025-12-25"})
        res = r["result"]
        self.assertTrue(res["covered"])
        self.assertEqual([s["kind"] for s in res["sections"]],
                         ["FIRST_READING", "PSALM", "SECOND_READING", "GOSPEL"])
        self.assertEqual(res["sections"][3]["citation"], "John 1:1-18")

    def test_lectionary_readings_uncovered(self):
        r = lectionary.lectionary_readings({"date": "2026-02-17"})  # ordinary-6-tuesday
        self.assertFalse(r["result"]["covered"])
        self.assertEqual(r["result"]["sections"], [])
        self.assertEqual(r["recommended_next_action"], "fetch-from-authoritative-source")

    def test_invalid_date_raises(self):
        from intelligence.contracts import BrainError

        with self.assertRaises(BrainError):
            lectionary.liturgical_day({"date": "not-a-date"})


if __name__ == "__main__":
    unittest.main()
