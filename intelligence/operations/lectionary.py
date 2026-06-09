"""
Liturgical-calendar + lectionary intelligence (General Roman Calendar).

The brain's deterministic knowledge of the Church's year: for any civil date
it computes the exact liturgical day (season, week, Sunday A/B/C + weekday I/II
cycle, colour, moveable feasts, and a Proper-of-Saints overlay) and the day's
Mass-reading citations. Pure stdlib — no network, no database. TypeScript (the
body) consults these ops, resolves the Scripture *text* from its public-domain
store, persists to DailyReading, and cycles/self-corrects daily.

This mirrors src/lib/content-shared/liturgical-calendar.ts + lectionary.ts so
the body and brain agree; the lectionaryKey is the shared join key.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from ..contracts import RISK_NONE, BrainError, envelope, require

_WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
_WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
_SEASON_LABELS = {
    "advent": "Advent",
    "christmas": "Christmas",
    "ordinary": "Ordinary Time",
    "lent": "Lent",
    "triduum": "Sacred Triduum",
    "easter": "Easter",
}
_SEASON_COLORS = {
    "advent": "Violet",
    "christmas": "White",
    "ordinary": "Green",
    "lent": "Violet",
    "triduum": "White",
    "easter": "White",
}


def _dow(d: date) -> int:
    """0 = Sunday … 6 = Saturday (to match the TS engine's getUTCDay)."""
    return (d.weekday() + 1) % 7


def _ordinal(n: int) -> str:
    if 10 <= (n % 100) <= 20:
        return f"{n}th"
    return f"{n}{ {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th') }"


def easter_sunday(year: int) -> date:
    """Gregorian Easter (Meeus/Jones/Butcher Computus)."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _first_sunday_of_advent(year: int) -> date:
    dec24 = date(year, 12, 24)
    fourth_sunday = dec24 - timedelta(days=_dow(dec24))
    return fourth_sunday - timedelta(days=21)


def _baptism_of_the_lord(year: int) -> date:
    jan6 = date(year, 1, 6)
    dow = _dow(jan6)
    return date(year, 1, 7) if dow == 0 else jan6 + timedelta(days=7 - dow)


def _advent_start_year(d: date) -> int:
    y = d.year
    return y if d >= _first_sunday_of_advent(y) else y - 1


def _season(d: date) -> str:
    year = d.year
    easter = easter_sunday(year)
    ash = easter - timedelta(days=46)
    holy_thu = easter - timedelta(days=3)
    holy_sat = easter - timedelta(days=1)
    pentecost = easter + timedelta(days=49)
    advent1 = _first_sunday_of_advent(year)
    dec24 = date(year, 12, 24)
    if date(year, 1, 1) <= d <= _baptism_of_the_lord(year):
        return "christmas"
    if ash <= d < holy_thu:
        return "lent"
    if holy_thu <= d <= holy_sat:
        return "triduum"
    if easter <= d <= pentecost:
        return "easter"
    if advent1 <= d <= dec24:
        return "advent"
    if date(year, 12, 25) <= d <= date(year, 12, 31):
        return "christmas"
    return "ordinary"


def _sunday_cycle(d: date) -> str:
    r = _advent_start_year(d) % 3
    return "A" if r == 0 else "B" if r == 1 else "C"


def _weekday_cycle(d: date) -> str:
    return "I" if (_advent_start_year(d) + 1) % 2 == 1 else "II"


def _color(d: date) -> str:
    season = _season(d)
    if season == "triduum":
        good_friday = easter_sunday(d.year) - timedelta(days=2)
        return "Red" if d == good_friday else "White"
    return _SEASON_COLORS[season]


def _sunday_on_or_before(d: date) -> date:
    return d - timedelta(days=_dow(d))


def _ordinary_time_week(d: date) -> int:
    ay = _advent_start_year(d)
    baptism = _baptism_of_the_lord(ay + 1)
    ash = easter_sunday(ay + 1) - timedelta(days=46)
    if d < ash:
        return ((_sunday_on_or_before(d) - baptism).days // 7) + 1
    christ_king = _first_sunday_of_advent(ay + 1) - timedelta(days=7)
    weeks_back = (christ_king - _sunday_on_or_before(d)).days // 7
    return 34 - weeks_back


def _season_week(d: date, season_start_sunday: date) -> int:
    return ((_sunday_on_or_before(d) - season_start_sunday).days // 7) + 1


# rank, celebration, lectionary_key, week_of_season
Temporal = Tuple[str, str, str, int]


def _single(rank: str, celebration: str, key: str) -> Temporal:
    return (rank, celebration, key, 0)


def _week_entry(dow: int, week: int, season_key: str, sunday_label: str, week_label: str) -> Temporal:
    if dow == 0:
        return ("SUNDAY", sunday_label, f"{season_key}-{week}-sunday", week)
    return (
        "WEEKDAY",
        f"{_WEEKDAY_LABELS[dow]} of the {week_label}",
        f"{season_key}-{week}-{_WEEKDAY_NAMES[dow]}",
        week,
    )


def _temporal_celebration(d: date) -> Temporal:
    dow = _dow(d)
    dow_label = _WEEKDAY_LABELS[dow]
    dow_name = _WEEKDAY_NAMES[dow]
    ay = _advent_start_year(d)
    easter = easter_sunday(ay + 1)
    from_easter = (d - easter).days
    SOL = "SOLEMNITY"

    # Holy Week + Triduum + Easter octave + Easter-anchored solemnities.
    if from_easter == -7:
        return _single("SUNDAY", "Palm Sunday of the Passion of the Lord", "palm-sunday")
    if from_easter == -6:
        return _single("WEEKDAY", "Monday of Holy Week", "holy-week-monday")
    if from_easter == -5:
        return _single("WEEKDAY", "Tuesday of Holy Week", "holy-week-tuesday")
    if from_easter == -4:
        return _single("WEEKDAY", "Wednesday of Holy Week", "holy-week-wednesday")
    if from_easter == -3:
        return _single(SOL, "Holy Thursday", "holy-thursday")
    if from_easter == -2:
        return _single(SOL, "Good Friday", "good-friday")
    if from_easter == -1:
        return _single(SOL, "Holy Saturday (Easter Vigil)", "easter-vigil")
    if from_easter == 0:
        return _single(SOL, "Easter Sunday", "easter-sunday")
    if 1 <= from_easter <= 6:
        return _single(SOL, f"{dow_label} within the Octave of Easter", f"easter-octave-{dow_name}")
    if from_easter == 39:
        return _single(SOL, "The Ascension of the Lord", "ascension")
    if from_easter == 49:
        return _single(SOL, "Pentecost Sunday", "pentecost")
    if from_easter == 56:
        return _single(SOL, "The Most Holy Trinity", "trinity-sunday")
    if from_easter == 60:
        return _single(SOL, "The Most Holy Body and Blood of Christ", "corpus-christi")
    if from_easter == 68:
        return _single(SOL, "The Most Sacred Heart of Jesus", "sacred-heart")

    season = _season(d)

    christ_king = _first_sunday_of_advent(ay + 1) - timedelta(days=7)
    if d == christ_king:
        return (SOL, "Our Lord Jesus Christ, King of the Universe", "christ-the-king", 34)

    if season == "advent":
        if d.month == 12 and 17 <= d.day <= 24 and dow != 0:
            md = f"{d.month:02d}{d.day:02d}"
            return (
                "WEEKDAY",
                f"{dow_label}, {_ordinal(d.day)} December (Advent)",
                f"advent-weekday-{md}",
                0,
            )
        w = _season_week(d, _first_sunday_of_advent(ay))
        return _week_entry(dow, w, "advent", f"{_ordinal(w)} Sunday of Advent", f"{_ordinal(w)} Week of Advent")

    if season == "christmas":
        if d.month == 12 and d.day == 25:
            return _single(SOL, "The Nativity of the Lord", "nativity")
        if d.month == 1 and d.day == 1:
            return _single(SOL, "Mary, the Holy Mother of God", "mary-mother-of-god")
        if d.month == 1 and d.day == 6:
            return _single(SOL, "The Epiphany of the Lord", "epiphany")
        if d == _baptism_of_the_lord(d.year):
            return _single("FEAST", "The Baptism of the Lord", "baptism-of-the-lord")
        if d.month == 12 and d == _holy_family_sunday(d.year):
            return _single("FEAST", "The Holy Family of Jesus, Mary and Joseph", "holy-family")
        md = f"{d.month:02d}{d.day:02d}"
        label = "Sunday after the Nativity" if dow == 0 else f"{dow_label} of the Christmas season"
        return ("SUNDAY" if dow == 0 else "WEEKDAY", label, f"christmas-weekday-{md}", 0)

    if season == "lent":
        ash = easter - timedelta(days=46)
        if d == ash:
            return _single("WEEKDAY", "Ash Wednesday", "ash-wednesday")
        if ash < d < ash + timedelta(days=4):
            return ("WEEKDAY", f"{dow_label} after Ash Wednesday", f"lent-after-ashes-{dow_name}", 0)
        first_sunday_lent = easter - timedelta(days=42)
        w = _season_week(d, first_sunday_lent)
        return _week_entry(dow, w, "lent", f"{_ordinal(w)} Sunday of Lent", f"{_ordinal(w)} Week of Lent")

    if season == "easter":
        w = _season_week(d, easter)
        if dow == 0 and w == 2:
            return _single("SUNDAY", "2nd Sunday of Easter (Divine Mercy)", "easter-2-sunday")
        return _week_entry(dow, w, "easter", f"{_ordinal(w)} Sunday of Easter", f"{_ordinal(w)} Week of Easter")

    # Ordinary Time.
    w = _ordinary_time_week(d)
    if dow == 0:
        return ("SUNDAY", f"{_ordinal(w)} Sunday in Ordinary Time", f"ordinary-{w}-sunday", w)
    return (
        "WEEKDAY",
        f"{dow_label} of the {_ordinal(w)} Week in Ordinary Time",
        f"ordinary-{w}-{dow_name}",
        w,
    )


def _holy_family_sunday(year: int) -> date:
    christmas = date(year, 12, 25)
    if _dow(christmas) == 0:
        return date(year, 12, 30)
    return christmas + timedelta(days=7 - _dow(christmas))


# Proper-of-Saints overlay: principal fixed-date solemnities. month, day, key,
# celebration. They outrank an Ordinary-Time Sunday; a privileged
# Advent/Lent/Easter Sunday wins (the feast transfers — we decline to override).
_SANCTORAL: List[Tuple[int, int, str, str]] = [
    (8, 15, "assumption", "The Assumption of the Blessed Virgin Mary"),
    (11, 1, "all-saints", "All Saints"),
    (12, 8, "immaculate-conception", "The Immaculate Conception of the Blessed Virgin Mary"),
]


def _sanctoral_override(d: date) -> Optional[Tuple[str, str]]:
    for month, day, key, celebration in _SANCTORAL:
        if d.month == month and d.day == day:
            season = _season(d)
            if season in ("advent", "lent", "easter") and _dow(d) == 0:
                return None
            return key, celebration
    return None


def resolve_day(d: date) -> Dict[str, Any]:
    """The precise liturgical day for a civil date (the shared lectionaryKey)."""
    sanctoral = _sanctoral_override(d)
    if sanctoral is not None:
        key, celebration = sanctoral
        return {
            "date": d.isoformat(),
            "season": _season(d),
            "seasonLabel": _SEASON_LABELS[_season(d)],
            "color": "White",
            "sundayCycle": _sunday_cycle(d),
            "weekdayCycle": _weekday_cycle(d),
            "dayOfWeek": _dow(d),
            "isSunday": _dow(d) == 0,
            "weekOfSeason": 0,
            "rank": "SOLEMNITY",
            "celebration": celebration,
            "lectionaryKey": key,
        }
    rank, celebration, key, week = _temporal_celebration(d)
    season = _season(d)
    return {
        "date": d.isoformat(),
        "season": season,
        "seasonLabel": _SEASON_LABELS[season],
        "color": _color(d),
        "sundayCycle": _sunday_cycle(d),
        "weekdayCycle": _weekday_cycle(d),
        "dayOfWeek": _dow(d),
        "isSunday": _dow(d) == 0,
        "weekOfSeason": week,
        "rank": rank,
        "celebration": celebration,
        "lectionaryKey": key,
    }


# The lectionary citation table — the brain's reading knowledge (citations only;
# the body resolves the public-domain text). Mirrors lectionary.ts. Keyed by
# lectionaryKey, or `${key}|${cycle}` for cycle-varying days.
_LECTIONARY: Dict[str, List[Tuple[str, str, str]]] = {
    "nativity": [
        ("FIRST_READING", "First Reading", "Isaiah 52:7-10"),
        ("PSALM", "Responsorial Psalm", "Psalm 98:1-6"),
        ("SECOND_READING", "Second Reading", "Hebrews 1:1-6"),
        ("GOSPEL", "Gospel", "John 1:1-18"),
    ],
    "epiphany": [
        ("FIRST_READING", "First Reading", "Isaiah 60:1-6"),
        ("PSALM", "Responsorial Psalm", "Psalm 72:1-2, 7-8, 10-13"),
        ("SECOND_READING", "Second Reading", "Ephesians 3:2-3a, 5-6"),
        ("GOSPEL", "Gospel", "Matthew 2:1-12"),
    ],
    "easter-sunday": [
        ("FIRST_READING", "First Reading", "Acts 10:34a, 37-43"),
        ("PSALM", "Responsorial Psalm", "Psalm 118:1-2, 16-17, 22-23"),
        ("SECOND_READING", "Second Reading", "Colossians 3:1-4"),
        ("GOSPEL", "Gospel", "John 20:1-9"),
    ],
    "pentecost": [
        ("FIRST_READING", "First Reading", "Acts 2:1-11"),
        ("PSALM", "Responsorial Psalm", "Psalm 104:1, 24, 29-31, 34"),
        ("SECOND_READING", "Second Reading", "1 Corinthians 12:3b-7, 12-13"),
        ("GOSPEL", "Gospel", "John 20:19-23"),
    ],
    "ash-wednesday": [
        ("FIRST_READING", "First Reading", "Joel 2:12-18"),
        ("PSALM", "Responsorial Psalm", "Psalm 51:3-6, 12-14, 17"),
        ("SECOND_READING", "Second Reading", "2 Corinthians 5:20—6:2"),
        ("GOSPEL", "Gospel", "Matthew 6:1-6, 16-18"),
    ],
    "holy-thursday": [
        ("FIRST_READING", "First Reading", "Exodus 12:1-8, 11-14"),
        ("PSALM", "Responsorial Psalm", "Psalm 116:12-13, 15-18"),
        ("SECOND_READING", "Second Reading", "1 Corinthians 11:23-26"),
        ("GOSPEL", "Gospel", "John 13:1-15"),
    ],
    "good-friday": [
        ("FIRST_READING", "First Reading", "Isaiah 52:13—53:12"),
        ("PSALM", "Responsorial Psalm", "Psalm 31:2, 6, 12-13, 15-17, 25"),
        ("SECOND_READING", "Second Reading", "Hebrews 4:14-16; 5:7-9"),
        ("GOSPEL", "Gospel", "John 18:1—19:42"),
    ],
    "mary-mother-of-god": [
        ("FIRST_READING", "First Reading", "Numbers 6:22-27"),
        ("PSALM", "Responsorial Psalm", "Psalm 67:2-3, 5-6, 8"),
        ("SECOND_READING", "Second Reading", "Galatians 4:4-7"),
        ("GOSPEL", "Gospel", "Luke 2:16-21"),
    ],
    "assumption": [
        ("FIRST_READING", "First Reading", "Revelation 11:19a; 12:1-6a, 10ab"),
        ("PSALM", "Responsorial Psalm", "Psalm 45:10-12, 16"),
        ("SECOND_READING", "Second Reading", "1 Corinthians 15:20-27"),
        ("GOSPEL", "Gospel", "Luke 1:39-56"),
    ],
    "all-saints": [
        ("FIRST_READING", "First Reading", "Revelation 7:2-4, 9-14"),
        ("PSALM", "Responsorial Psalm", "Psalm 24:1-6"),
        ("SECOND_READING", "Second Reading", "1 John 3:1-3"),
        ("GOSPEL", "Gospel", "Matthew 5:1-12a"),
    ],
    "immaculate-conception": [
        ("FIRST_READING", "First Reading", "Genesis 3:9-15, 20"),
        ("PSALM", "Responsorial Psalm", "Psalm 98:1-4"),
        ("SECOND_READING", "Second Reading", "Ephesians 1:3-6, 11-12"),
        ("GOSPEL", "Gospel", "Luke 1:26-38"),
    ],
}


def _readings_for(key: str, cycle: str) -> Optional[List[Dict[str, Any]]]:
    specs = _LECTIONARY.get(f"{key}|{cycle}") or _LECTIONARY.get(key)
    if not specs:
        return None
    return [{"kind": k, "label": label, "citation": citation} for (k, label, citation) in specs]


def _parse_date(payload: Dict[str, Any]) -> date:
    raw = require(payload, "date")
    try:
        return date.fromisoformat(str(raw)[:10])
    except ValueError as exc:
        raise BrainError(f"invalid date: {raw!r} (expected YYYY-MM-DD)") from exc


# ── Operations ───────────────────────────────────────────────────────────────


def liturgical_day(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Compute the precise liturgical day (General Roman Calendar) for a date."""
    d = _parse_date(payload)
    day = resolve_day(d)
    return envelope(
        result=day,
        confidence=1.0,
        reasoning=f"{day['celebration']} ({day['seasonLabel']}, cycle {day['sundayCycle']}/{day['weekdayCycle']}).",
        evidence=[f"lectionaryKey={day['lectionaryKey']}", f"color={day['color']}"],
        risk_level=RISK_NONE,
        recommended_next_action="resolve-readings",
        safe_to_auto_execute=True,
    )


def lectionary_readings(payload: Dict[str, Any]) -> Dict[str, Any]:
    """The day's Mass readings (citations, in proclamation order) for a date.

    Citations only — deterministic Church knowledge. The body resolves the
    public-domain Scripture text and stores it; days not in the table return
    covered=false so the body keeps the official link.
    """
    d = _parse_date(payload)
    day = resolve_day(d)
    sections = _readings_for(day["lectionaryKey"], day["sundayCycle"])
    covered = sections is not None
    return envelope(
        result={
            "date": day["date"],
            "lectionaryKey": day["lectionaryKey"],
            "celebration": day["celebration"],
            "sundayCycle": day["sundayCycle"],
            "weekdayCycle": day["weekdayCycle"],
            "covered": covered,
            "sections": sections or [],
        },
        confidence=1.0 if covered else 0.4,
        reasoning=(
            f"{day['celebration']}: {len(sections)} reading(s) cited."
            if covered
            else f"{day['celebration']}: not in the lectionary table yet; use the official source."
        ),
        evidence=[f"lectionaryKey={day['lectionaryKey']}", f"covered={covered}"],
        risk_level=RISK_NONE,
        recommended_next_action="resolve-text" if covered else "fetch-from-authoritative-source",
        safe_to_auto_execute=True,
    )
