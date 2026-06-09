"""
Formal logic rules — the app's critical invariants as checkable predicates.

Catholic source rules, publishing rules, quality rules, and safety rules are
encoded as deterministic predicates over a state dict TypeScript supplies. The
brain reports which rule passed or failed and why; TypeScript enforces the
verdict at the gate. Mirrors the spec's invariant list.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Tuple

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, RISK_NONE, BrainError, envelope, opt, require

State = Dict[str, Any]
# A rule returns (applies, ok, detail).
Rule = Callable[[State], Tuple[bool, bool, str]]


def _has(state: State, *keys: str) -> List[str]:
    return [k for k in keys if not state.get(k)]


_SENSITIVE = {"DOCTRINE", "SACRAMENT", "CHURCH_DOCUMENT", "CATECHISM", "CANON_LAW",
              "PAPAL_DOCUMENT", "COUNCIL", "LITURGICAL", "APPARITION", "POPE"}


def _r_doctrinal(s: State):
    sensitive = str(s.get("contentType", "")).upper() in _SENSITIVE or s.get("sensitive")
    if not sensitive:
        return (False, True, "not doctrinally sensitive")
    ok = int(s.get("trustedSourceCount", 0)) >= 2
    return (True, ok, "sensitive content needs ≥2 trusted sources" if not ok else "trusted support present")


def _r_communion(s: State):
    risk = str(s.get("communionRisk", "none")).lower()
    if risk in ("none", "low", "resolved", ""):
        return (False, True, "no unresolved communion risk")
    ok = bool(s.get("communionResolved"))
    return (True, ok, "unresolved communion risk blocks autonomous publish" if not ok else "communion risk resolved")


def _r_feast(s: State):
    if str(s.get("contentType", "")).upper() not in ("LITURGICAL", "SAINT", "FEAST"):
        return (False, True, "no feast-day claim")
    if not s.get("feastDay"):
        return (False, True, "no feast day to validate")
    ok = bool(s.get("calendarMatch"))
    return (True, ok, "feast day must match the liturgical calendar" if not ok else "feast matches calendar")


def _r_church_document(s: State):
    if str(s.get("contentType", "")).upper() != "CHURCH_DOCUMENT":
        return (False, True, "n/a")
    missing = _has(s, "title", "authority", "documentType", "citation", "sourceUrl", "route")
    return (True, not missing, f"missing {missing}" if missing else "all required fields present")


def _r_saint(s: State):
    if str(s.get("contentType", "")).upper() != "SAINT":
        return (False, True, "n/a")
    missing = _has(s, "saintName", "sourceUrl")
    ok = not missing and int(s.get("sourceCount", 0)) >= 1
    return (True, ok, f"missing {missing or 'source support'}" if not ok else "saint identity + source present")


def _r_papal(s: State):
    if str(s.get("contentType", "")).upper() != "PAPAL_DOCUMENT":
        return (False, True, "n/a")
    missing = _has(s, "author", "title", "documentType", "date", "citation")
    return (True, not missing, f"missing {missing}" if missing else "papal fields present")


def _r_duplicate(s: State):
    score = float(s.get("duplicateScore", 0.0))
    threshold = float(s.get("duplicateThreshold", 0.85))
    if score < threshold:
        return (False, True, "not a blocking duplicate")
    return (True, False, f"duplicate score {score} ≥ {threshold} blocks publish")


def _r_route(s: State):
    if not s.get("publicContentType"):
        return (False, True, "n/a")
    ok = bool(s.get("route"))
    return (True, ok, "public content type needs a public route to count as complete" if not ok else "route present")


def _r_mission(s: State):
    if "missionActivity" not in s:
        return (False, True, "n/a")
    activity = float(s.get("missionActivity", 0))
    growth = float(s.get("missionGrowth", 0))
    ok = not (activity > 0 and growth <= 0)
    return (True, ok, "activity without measurable growth = unhealthy mission" if not ok else "mission healthy")


def _r_developer_request(s: State):
    if str(s.get("kind", "")).upper() != "DEVELOPER_REQUEST" and "developerRequest" not in s:
        return (False, True, "n/a")
    dr = s.get("developerRequest", s)
    missing = [k for k in ("evidence", "affectedArea", "severity", "expectedGain") if not dr.get(k)]
    return (True, not missing, f"developer request missing {missing}" if missing else "developer request well-formed")


_RULES: Dict[str, Tuple[str, Rule]] = {
    "doctrinal_trusted_support": ("Doctrinally sensitive content cannot auto-publish without ≥2 trusted sources.", _r_doctrinal),
    "communion_risk_block": ("A source with unresolved communion risk cannot be used for autonomous publication.", _r_communion),
    "feast_calendar_match": ("A claimed feast day must match the liturgical calendar context.", _r_feast),
    "church_document_complete": ("A church document needs title, authority, type, citation, source URL, and route.", _r_church_document),
    "saint_identity_support": ("A saint biography needs identity fields + source support.", _r_saint),
    "papal_document_complete": ("A papal document needs author, title, type, date, and citation.", _r_papal),
    "duplicate_block": ("A duplicate above the blocking threshold cannot be published.", _r_duplicate),
    "route_required": ("A public content type is not complete without a public route.", _r_route),
    "mission_growth": ("A mission is not healthy if activity occurs without measurable growth.", _r_mission),
    "developer_request_evidence": ("A developer request must include evidence, area, severity, and expected gain.", _r_developer_request),
}


def build_logic_rules(payload: Dict[str, Any]) -> Dict[str, Any]:
    rules = [{"id": rid, "description": desc} for rid, (desc, _) in _RULES.items()]
    return envelope(
        result={"rules": rules, "count": len(rules)},
        confidence=0.95, reasoning=f"{len(rules)} formal invariants.",
        evidence=[r["id"] for r in rules[:5]], risk_level=RISK_NONE,
        recommended_next_action="check-invariants", safe_to_auto_execute=True,
    )


def _eval_all(state: State) -> List[Dict[str, Any]]:
    out = []
    for rid, (desc, fn) in _RULES.items():
        applies, ok, detail = fn(state)
        if applies:
            out.append({"id": rid, "ok": ok, "detail": detail, "description": desc})
    return out


def check_invariants(payload: Dict[str, Any]) -> Dict[str, Any]:
    state = require(payload, "state")
    if not isinstance(state, dict):
        raise BrainError("state must be an object")
    evaluated = _eval_all(state)
    failed = [e for e in evaluated if not e["ok"]]
    passed = [e for e in evaluated if e["ok"]]
    risk = RISK_HIGH if failed else RISK_NONE
    return envelope(
        result={"all_pass": not failed, "passed": [e["id"] for e in passed],
                "failed": failed, "applicable": len(evaluated)},
        confidence=0.9,
        reasoning=("All applicable invariants hold." if not failed
                   else f"{len(failed)} invariant(s) failed: {[e['id'] for e in failed]}."),
        evidence=[f"{e['id']}:{'ok' if e['ok'] else 'FAIL'}" for e in evaluated[:6]],
        risk_level=risk,
        recommended_next_action="block-and-review" if failed else "invariants-ok",
        safe_to_auto_execute=not failed,
    )


def evaluate_logic_rule(payload: Dict[str, Any]) -> Dict[str, Any]:
    rid = str(require(payload, "rule_id"))
    state = opt(payload, "state", {}) or {}
    if rid not in _RULES:
        raise BrainError(f"unknown rule: {rid}")
    desc, fn = _RULES[rid]
    applies, ok, detail = fn(state)
    return envelope(
        result={"rule_id": rid, "applies": applies, "ok": ok, "detail": detail, "description": desc},
        confidence=0.9,
        reasoning=f"{rid}: {'passes' if ok else 'FAILS'} — {detail}.",
        evidence=[detail], risk_level=RISK_NONE if ok else RISK_HIGH,
        recommended_next_action="explain-rule-failure" if not ok else "continue",
        safe_to_auto_execute=ok,
    )


def detect_rule_conflict(payload: Dict[str, Any]) -> Dict[str, Any]:
    """A conflict = a state where a publish-permitting outcome coexists with a
    hard block (e.g. all completeness rules pass but a duplicate/communion block
    fires). The block always wins; we surface the tension for the audit trail."""
    state = require(payload, "state")
    evaluated = _eval_all(state)
    blocks = [e for e in evaluated if not e["ok"] and e["id"] in ("duplicate_block", "communion_risk_block")]
    completeness_ok = all(e["ok"] for e in evaluated if e["id"] not in ("duplicate_block", "communion_risk_block"))
    conflict = bool(blocks) and completeness_ok
    return envelope(
        result={"conflict": conflict, "blocking_rules": [b["id"] for b in blocks],
                "completeness_ok": completeness_ok, "resolution": "block wins" if conflict else "none"},
        confidence=0.85,
        reasoning=("Completeness passes but a hard block fires — block wins." if conflict
                   else "No rule conflict."),
        evidence=[b["id"] for b in blocks] or ["no blocks"],
        risk_level=RISK_HIGH if conflict else RISK_NONE,
        recommended_next_action="enforce-block" if conflict else "continue",
        safe_to_auto_execute=not conflict,
    )


def prove_rule_satisfaction(payload: Dict[str, Any]) -> Dict[str, Any]:
    rid = str(require(payload, "rule_id"))
    state = opt(payload, "state", {}) or {}
    if rid not in _RULES:
        raise BrainError(f"unknown rule: {rid}")
    desc, fn = _RULES[rid]
    applies, ok, detail = fn(state)
    return envelope(
        result={"rule_id": rid, "satisfied": ok and applies if applies else ok,
                "applies": applies, "proof": detail, "description": desc},
        confidence=0.9,
        reasoning=f"{rid} {'satisfied' if ok else 'not satisfied'}: {detail}.",
        evidence=[detail], risk_level=RISK_NONE if ok else RISK_MEDIUM,
        recommended_next_action="continue" if ok else "remediate",
        safe_to_auto_execute=ok,
    )


def explain_rule_failure(payload: Dict[str, Any]) -> Dict[str, Any]:
    rid = str(require(payload, "rule_id"))
    state = opt(payload, "state", {}) or {}
    if rid not in _RULES:
        raise BrainError(f"unknown rule: {rid}")
    desc, fn = _RULES[rid]
    applies, ok, detail = fn(state)
    if ok:
        return envelope(result={"failed": False, "explanation": f"{rid} passes."},
                        confidence=0.9, reasoning="Rule passes.", risk_level=RISK_NONE,
                        recommended_next_action="continue", safe_to_auto_execute=True)
    return envelope(
        result={"failed": True, "rule_id": rid, "rule": desc, "why": detail,
                "remediation": f"satisfy: {detail}"},
        confidence=0.85,
        reasoning=f"{rid} failed because {detail}.",
        evidence=[detail], risk_level=RISK_HIGH,
        recommended_next_action="remediate-then-recheck", safe_to_auto_execute=False,
    )
