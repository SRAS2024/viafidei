"""
Confidence calibration + outcome grading.

The brain measures whether its own predictions came true and adjusts confidence
per operation: operations that perform poorly get their confidence lowered;
reliable ones get it raised. Deterministic + stdlib; reasons over
prediction/outcome records TypeScript supplies from the audit trail.

A prediction record: {op, predicted (bool|str), actual (bool|str),
confidence (0..1)}.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..contracts import RISK_LOW, RISK_MEDIUM, RISK_NONE, envelope, opt, require
from ..core import clamp


def _records(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    recs = require(payload, "records")
    return [r for r in recs if isinstance(r, dict)] if isinstance(recs, list) else []


def _correct(r: Dict[str, Any]) -> bool:
    return _norm(r.get("predicted")) == _norm(r.get("actual"))


def _norm(v: Any) -> str:
    if isinstance(v, bool):
        return "success" if v else "failure"
    return str(v).strip().lower()


def measure_prediction_accuracy(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Per-op accuracy from prediction/outcome records."""
    recs = _records(payload)
    by_op: Dict[str, List[bool]] = {}
    for r in recs:
        by_op.setdefault(str(r.get("op", "unknown")), []).append(_correct(r))
    per_op = {
        op: {"n": len(v), "accuracy": round(sum(v) / len(v), 3)} for op, v in by_op.items() if v
    }
    overall = round(sum(1 for r in recs if _correct(r)) / len(recs), 3) if recs else 0.0
    return envelope(
        result={"overall_accuracy": overall, "per_op": per_op, "sample_size": len(recs)},
        confidence=clamp(0.5 + 0.4 * min(len(recs) / 50, 1.0)),
        reasoning=f"Prediction accuracy {int(overall * 100)}% over {len(recs)} record(s).",
        evidence=[f"{op}: {v['accuracy']}" for op, v in list(per_op.items())[:6]] or ["no records"],
        risk_level=RISK_MEDIUM if overall < 0.6 and recs else RISK_NONE,
        recommended_next_action="recalibrate-low-accuracy-ops" if overall < 0.6 else "accuracy-acceptable",
    )


def calibrate_confidence(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Recommend a confidence multiplier per op based on realised accuracy."""
    recs = _records(payload)
    by_op: Dict[str, List[Dict[str, Any]]] = {}
    for r in recs:
        by_op.setdefault(str(r.get("op", "unknown")), []).append(r)
    adjustments: List[Dict[str, Any]] = []
    for op, rows in by_op.items():
        if len(rows) < 3:
            continue
        acc = sum(1 for r in rows if _correct(r)) / len(rows)
        avg_conf = sum(float(r.get("confidence", 0.7)) for r in rows) / len(rows)
        gap = acc - avg_conf  # positive → under-confident, negative → over-confident
        # multiplier nudges future confidence toward realised accuracy.
        multiplier = round(clamp(1.0 + gap, 0.5, 1.3), 3)
        adjustments.append(
            {
                "op": op,
                "accuracy": round(acc, 3),
                "avg_confidence": round(avg_conf, 3),
                "direction": "raise" if gap > 0.05 else "lower" if gap < -0.05 else "hold",
                "confidence_multiplier": multiplier,
                "sample": len(rows),
            }
        )
    adjustments.sort(key=lambda a: abs(1 - a["confidence_multiplier"]), reverse=True)
    return envelope(
        result={"adjustments": adjustments, "op_count": len(adjustments)},
        confidence=clamp(0.5 + 0.4 * min(len(recs) / 50, 1.0)),
        reasoning=f"Calibrated {len(adjustments)} op(s) from realised accuracy vs stated confidence.",
        evidence=[f"{a['op']}: {a['direction']} ×{a['confidence_multiplier']}" for a in adjustments[:6]]
        or ["insufficient data"],
        risk_level=RISK_LOW,
        recommended_next_action="apply-confidence-multipliers" if adjustments else "need-more-data",
    )


def grade_brain_decision(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Grade one past decision: was the predicted outcome correct?"""
    decision = require(payload, "decision")
    predicted = _norm(decision.get("predicted"))
    actual = _norm(decision.get("actual"))
    correct = predicted == actual
    conf = float(decision.get("confidence", 0.7))
    # Brier-style penalty: confident-and-wrong is the worst.
    quality = clamp(1.0 - (conf if not correct else (1 - conf)) * (1.0 if not correct else 0.4))
    grade = "A" if quality >= 0.85 else "B" if quality >= 0.7 else "C" if quality >= 0.5 else "D"
    return envelope(
        result={"correct": correct, "quality": round(quality, 3), "grade": grade},
        confidence=0.85,
        reasoning=f"Decision graded {grade}: predicted '{predicted}', actual '{actual}'.",
        evidence=[f"correct={correct}", f"confidence={conf}"],
        risk_level=RISK_MEDIUM if (not correct and conf > 0.75) else RISK_NONE,
        recommended_next_action="lower-confidence-for-op" if (not correct and conf > 0.75) else "decision-ok",
    )


def track_false_positive_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """FP rate: predicted-positive that were actually negative (e.g. false duplicate/communion flags)."""
    recs = _records(payload)
    pos = [r for r in recs if _norm(r.get("predicted")) in ("success", "positive", "duplicate", "risk", "true")]
    fp = [r for r in pos if not _correct(r)]
    rate = round(len(fp) / len(pos), 3) if pos else 0.0
    return envelope(
        result={"false_positive_rate": rate, "false_positives": len(fp), "predicted_positives": len(pos)},
        confidence=clamp(0.5 + 0.4 * min(len(pos) / 30, 1.0)),
        reasoning=f"False-positive rate {int(rate * 100)}% ({len(fp)}/{len(pos)}).",
        evidence=[f"{len(fp)} false positives"],
        risk_level=RISK_MEDIUM if rate > 0.3 else RISK_NONE,
        recommended_next_action="loosen-over-strict-gate" if rate > 0.3 else "fp-acceptable",
    )


def track_false_negative_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """FN rate: predicted-negative that were actually positive (e.g. missed duplicates)."""
    recs = _records(payload)
    neg = [r for r in recs if _norm(r.get("predicted")) in ("failure", "negative", "distinct", "clean", "false")]
    fn = [r for r in neg if not _correct(r)]
    rate = round(len(fn) / len(neg), 3) if neg else 0.0
    return envelope(
        result={"false_negative_rate": rate, "false_negatives": len(fn), "predicted_negatives": len(neg)},
        confidence=clamp(0.5 + 0.4 * min(len(neg) / 30, 1.0)),
        reasoning=f"False-negative rate {int(rate * 100)}% ({len(fn)}/{len(neg)}).",
        evidence=[f"{len(fn)} false negatives"],
        risk_level=RISK_MEDIUM if rate > 0.3 else RISK_NONE,
        recommended_next_action="tighten-too-loose-gate" if rate > 0.3 else "fn-acceptable",
    )


def score_decision_quality(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Aggregate decision quality across records (accuracy + calibration)."""
    recs = _records(payload)
    if not recs:
        return envelope(
            result={"decision_quality": 0.0, "sample_size": 0},
            confidence=0.2,
            reasoning="No decision records to score.",
            risk_level=RISK_LOW,
            recommended_next_action="need-records",
        )
    acc = sum(1 for r in recs if _correct(r)) / len(recs)
    # calibration error: mean |confidence - correctness|
    cal_err = sum(abs(float(r.get("confidence", 0.7)) - (1.0 if _correct(r) else 0.0)) for r in recs) / len(recs)
    quality = clamp(0.6 * acc + 0.4 * (1 - cal_err))
    return envelope(
        result={
            "decision_quality": round(quality, 3),
            "accuracy": round(acc, 3),
            "calibration_error": round(cal_err, 3),
            "sample_size": len(recs),
        },
        confidence=clamp(0.5 + 0.4 * min(len(recs) / 50, 1.0)),
        reasoning=f"Decision quality {round(quality, 3)} (accuracy {round(acc, 3)}, calibration error {round(cal_err, 3)}).",
        evidence=[f"accuracy={round(acc, 3)}", f"calibration_error={round(cal_err, 3)}"],
        risk_level=RISK_MEDIUM if quality < 0.6 else RISK_NONE,
        recommended_next_action="improve-low-quality-ops" if quality < 0.6 else "quality-good",
    )
