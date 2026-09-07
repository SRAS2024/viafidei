"""
Golden-set tests for the liturgical-calendar + lectionary brain operations.

The brain reads the table exported from the TypeScript engine
(intelligence/data/liturgical-days.json, US calendar). Assertions are
externally verifiable facts (published USCCB calendar dates), plus a check
that the loader decodes the table exactly as written and that the ops fail
open when the table is absent.
"""

from __future__ import annotations

import json
import os
import unittest
from datetime import date, timedelta

from intelligence.operations import lectionary


def key(iso: str) -> str:
    return lectionary.resolve_day(date.fromisoformat(iso))["lectionaryKey"]


def day(iso: str):
    return lectionary.resolve_day(date.fromisoformat(iso))


class TestGoldenTable(unittest.TestCase):
    def test_table_is_present_and_used(self):
        self.assertTrue(lectionary.golden_table_available(), lectionary.GOLDEN_TABLE_PATH)
        self.assertEqual(day("2025-12-25")["source"], "golden-table")
        self.assertEqual(day("2025-12-25")["calendar"], "roman-us")

    def test_sample_of_dates_matches_the_json_rows(self):
        with open(lectionary.GOLDEN_TABLE_PATH, "r", encoding="utf-8") as fh:
            table = json.load(fh)
        start = date.fromisoformat(table["start"])
        rows = table["rows"]
        self.assertGreater(len(rows), 36000)
        checked = 0
        for offset in list(range(0, len(rows), 97)) + [0, len(rows) - 1]:
            d = start + timedelta(days=offset)
            row = rows[offset]
            got = lectionary.resolve_day(d)
            self.assertEqual(got["lectionaryKey"], table["keys"][row[0]], d)
            self.assertEqual(got["temporalKey"], table["keys"][row[1]], d)
            self.assertEqual(got["celebration"], table["celebrations"][row[2]], d)
            self.assertEqual(got["rank"], table["ranks"][row[3]], d)
            self.assertEqual(got["color"], table["colors"][row[4]], d)
            self.assertEqual(got["season"], table["seasons"][row[5]], d)
            self.assertEqual(got["weekOfSeason"], row[6], d)
            self.assertEqual(got["sundayCycle"], table["sundayCycles"][row[7]], d)
            self.assertEqual(got["weekdayCycle"], table["weekdayCycles"][row[8]], d)
            checked += 1
        self.assertGreater(checked, 300)

    def test_fails_open_without_the_table(self):
        previous = os.environ.get("VIAFIDEI_LITURGICAL_DAYS_JSON")
        os.environ["VIAFIDEI_LITURGICAL_DAYS_JSON"] = "/nonexistent/liturgical-days.json"
        lectionary._golden_table.cache_clear()
        try:
            self.assertFalse(lectionary.golden_table_available())
            d = day("2025-12-25")
            self.assertEqual(d["lectionaryKey"], "nativity")
            self.assertEqual(d["source"], "computed")
            r = lectionary.liturgical_day({"date": "2025-12-25"})
            self.assertTrue(r["ok"])
            self.assertLess(r["confidence"], 1.0)
        finally:
            if previous is None:
                os.environ.pop("VIAFIDEI_LITURGICAL_DAYS_JSON", None)
            else:
                os.environ["VIAFIDEI_LITURGICAL_DAYS_JSON"] = previous
            lectionary._golden_table.cache_clear()
        self.assertTrue(lectionary.golden_table_available())


class TestLiturgicalCalendar(unittest.TestCase):
    def test_easter_computus(self):
        self.assertEqual(lectionary.easter_sunday(2025), date(2025, 4, 20))
        self.assertEqual(lectionary.easter_sunday(2026), date(2026, 4, 5))

    def test_easter_anchored_days_2025_us_calendar(self):
        self.assertEqual(key("2025-04-13"), "palm-sunday")
        self.assertEqual(key("2025-04-17"), "holy-thursday")
        self.assertEqual(key("2025-04-18"), "good-friday")
        self.assertEqual(key("2025-04-20"), "easter-sunday")
        self.assertEqual(key("2025-04-27"), "easter-2-sunday")  # Divine Mercy
        # US: the Ascension is kept on the 7th Sunday of Easter; Thursday is ferial.
        self.assertEqual(key("2025-05-29"), "easter-6-thursday")
        self.assertEqual(key("2025-06-01"), "ascension")
        self.assertEqual(key("2025-06-08"), "pentecost")
        self.assertEqual(key("2025-06-15"), "trinity-sunday")
        # US: Corpus Christi on the Sunday after Trinity.
        self.assertEqual(key("2025-06-19"), "ordinary-11-thursday")
        self.assertEqual(key("2025-06-22"), "corpus-christi")

    def test_advent_christmas_and_ordinary_numbering(self):
        self.assertEqual(key("2024-11-24"), "christ-the-king")
        self.assertEqual(key("2024-12-01"), "advent-1-sunday")
        self.assertEqual(key("2025-12-17"), "advent-1217")
        self.assertEqual(key("2024-12-25"), "nativity")
        self.assertEqual(key("2025-01-01"), "mary-mother-of-god")
        self.assertEqual(key("2025-01-12"), "baptism-of-the-lord")
        self.assertEqual(key("2025-01-19"), "ordinary-2-sunday")
        # US Epiphany Sunday 7 Jan 2024 → Baptism on Monday → OT begins Tuesday.
        self.assertEqual(key("2024-01-07"), "epiphany")
        self.assertEqual(key("2024-01-08"), "baptism-of-the-lord")
        self.assertEqual(key("2024-01-09"), "ordinary-1-tuesday")
        self.assertEqual(key("2026-01-08"), "after-epiphany-thursday")

    def test_sanctoral_overlay_transfers_and_memorials(self):
        self.assertEqual(key("2025-08-15"), "assumption")
        self.assertEqual(key("2025-11-01"), "all-saints")
        self.assertEqual(key("2025-11-02"), "all-souls")  # outranks the OT Sunday
        self.assertEqual(key("2025-12-08"), "immaculate-conception")
        # 8 Dec 2024 is the 2nd Sunday of Advent → transferred to Monday.
        self.assertEqual(key("2024-12-08"), "advent-2-sunday")
        self.assertEqual(key("2024-12-09"), "immaculate-conception")
        self.assertEqual(key("2024-04-08"), "annunciation")  # from Monday of Holy Week
        agnes = day("2025-01-21")
        self.assertEqual(agnes["rank"], "MEMORIAL")
        self.assertEqual(agnes["celebration"], "Saint Agnes, Virgin and Martyr")
        self.assertEqual(agnes["lectionaryKey"], "ordinary-2-tuesday")  # ferial readings
        self.assertEqual(agnes["temporalKey"], "ordinary-2-tuesday")
        self.assertEqual(agnes["color"], "Red")

    def test_cycle_letters(self):
        d = day("2025-01-19")
        self.assertEqual(d["sundayCycle"], "C")
        self.assertEqual(d["weekdayCycle"], "I")


class TestLectionaryOps(unittest.TestCase):
    def test_liturgical_day_envelope(self):
        r = lectionary.liturgical_day({"date": "2026-04-05"})
        self.assertTrue(r["ok"])
        self.assertEqual(r["result"]["lectionaryKey"], "easter-sunday")
        self.assertEqual(r["result"]["color"], "White")
        self.assertEqual(r["confidence"], 1.0)
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
