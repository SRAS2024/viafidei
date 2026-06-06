"""
Repair intelligence + webpage-fetch diagnosis.

``classify_failure`` turns a raw failure into a category, a likely cause
and a ranked list of fixes, and says whether the right move is a retry, a
permanent fix or an escalation. ``diagnose_fetch`` classifies *why* a page
could not be read and recommends a better extraction strategy or a
developer capability request.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from ..contracts import RISK_HIGH, RISK_LOW, RISK_MEDIUM, envelope, opt, require
from ..core import normalize_text

# (regex, category, likely_cause, ranked_fixes)
_FAILURE_RULES: List[Tuple[str, str, str, List[str]]] = [
    (r"econnrefused|etimedout|enotfound|network|socket|dns", "source_problem",
     "network/host unreachable", ["retry-with-backoff", "try-alternate-source", "request-mirror"]),
    (r"\b429\b|rate.?limit|too many requests", "rate_limit_problem",
     "source rate limited the worker", ["respect-retry-after", "lower-per-host-concurrency", "schedule-later"]),
    (r"\b40[13]\b|forbidden|unauthorized|captcha|access denied|blocked", "source_problem",
     "page blocked the fetcher", ["rotate-user-agent", "try-alternate-source", "request-dynamic-fetcher"]),
    (r"\b404\b|not found|gone", "source_problem",
     "page missing / moved", ["resolve-new-url", "try-alternate-source", "mark-source-dead"]),
    (r"\b5\d\d\b|server error|bad gateway|service unavailable", "source_problem",
     "source server error", ["retry-with-backoff", "schedule-later", "try-alternate-source"]),
    (r"prisma|unique constraint|p200\d|foreign key|column .* does not exist", "schema_problem",
     "database constraint / schema mismatch", ["inspect-schema", "fix-data-shape", "propose-schema-change"]),
    (r"zod|validation|invalid|required field|missing field|schema validation", "validation_problem",
     "payload failed validation", ["repair-missing-fields", "re-extract-from-source", "tighten-extractor"]),
    (r"duplicate|already exists|slug.*taken|collision", "duplicate_problem",
     "would create a duplicate", ["link-to-existing", "merge-records", "skip-create"]),
    (r"publish|gate|threshold|not allowed to publish", "publishing_problem",
     "publish gate refused", ["raise-quality", "add-citation", "escalate-for-review"]),
    (r"render|hydration|template|tsx|component|layout", "rendering_problem",
     "public rendering failed", ["fix-template-data", "add-missing-field", "open-ui-task"]),
    (r"communion|doctrine|noncanonical|heretic|schism", "doctrine_problem",
     "doctrinal / communion concern", ["seek-authoritative-source", "draft-only", "escalate-for-review"]),
    (r"missing|no source|no citation|empty|insufficient data", "missing_data_problem",
     "not enough trusted data", ["run-research-job", "seek-additional-sources", "create-review-task"]),
    (r"injection|malicious|suspicious|spoof|xss|script", "security_problem",
     "suspicious/untrusted content", ["quarantine-content", "re-sanitize", "escalate-for-review"]),
    (r"undefined is not|cannot read|typeerror|referenceerror|stack", "code_problem",
     "worker code defect", ["open-bug-task", "add-regression-test", "guard-input"]),
]


def classify_failure(payload: Dict[str, Any]) -> Dict[str, Any]:
    failure = require(payload, "failure")
    blob = normalize_text(
        " ".join(
            str(failure.get(k) or "")
            for k in ("stage", "error", "message", "context", "code")
        )
    )
    status = failure.get("httpStatus")
    if status is not None:
        blob += f" {status}"

    category = "capability_limitation"
    cause = "unrecognised failure — likely a missing capability"
    fixes = ["create-capability-request", "log-for-self-inspection", "escalate-for-review"]
    matched = False
    for pattern, cat, why, options in _FAILURE_RULES:
        if re.search(pattern, blob):
            category, cause, fixes, matched = cat, why, list(options), True
            break

    # Map category -> disposition.
    retryable = category in {"source_problem", "rate_limit_problem"}
    permanent = category in {"schema_problem", "code_problem", "capability_limitation"}
    if category in {"doctrine_problem", "security_problem"}:
        risk, action = RISK_HIGH, "escalate-for-review"
    elif permanent:
        risk, action = RISK_MEDIUM, "open-developer-request"
    elif retryable:
        risk, action = RISK_LOW, fixes[0]
    else:
        risk, action = RISK_MEDIUM, fixes[0]

    flags = {
        "is_source_problem": category == "source_problem",
        "is_schema_problem": category == "schema_problem",
        "is_validation_problem": category == "validation_problem",
        "is_duplicate_problem": category == "duplicate_problem",
        "is_publishing_problem": category == "publishing_problem",
        "is_rendering_problem": category == "rendering_problem",
        "is_doctrine_problem": category == "doctrine_problem",
        "is_missing_data_problem": category == "missing_data_problem",
        "is_rate_limit_problem": category == "rate_limit_problem",
        "is_security_problem": category == "security_problem",
        "is_code_problem": category == "code_problem",
        "is_capability_limitation": category == "capability_limitation",
    }

    return envelope(
        result={
            "category": category,
            "likely_cause": cause,
            "ranked_fixes": fixes,
            "retryable": retryable,
            "permanent": permanent,
            "flags": flags,
            "recognised": matched,
        },
        confidence=0.8 if matched else 0.4,
        reasoning=f"Classified failure as {category}: {cause}.",
        evidence=[f"matched-rule={matched}", f"http_status={status}"] if status is not None else [f"matched-rule={matched}"],
        risk_level=risk,
        recommended_next_action=action,
        safe_to_auto_execute=retryable,
    )


def diagnose_fetch(payload: Dict[str, Any]) -> Dict[str, Any]:
    fetch = require(payload, "fetch")
    status = fetch.get("httpStatus")
    content_len = int(opt(fetch, "contentLength", 0))
    rendered_len = int(opt(fetch, "renderedTextLength", 0))
    ctype = normalize_text(str(opt(fetch, "contentType", "")))
    html = str(opt(fetch, "htmlSnippet", ""))
    html_low = normalize_text(html)
    blocked = bool(opt(fetch, "blocked", False))
    url = str(opt(fetch, "url", ""))

    issue = "unknown"
    method = "retry-standard-fetch"
    cause = ""
    risk = RISK_LOW

    if blocked or status in (401, 403, 429) or "captcha" in html_low or "access denied" in html_low:
        issue, cause, method, risk = (
            "blocked_page",
            "the source actively blocked the fetcher (auth/captcha/rate-limit)",
            "request-dynamic-fetcher-or-alternate-source",
            RISK_MEDIUM,
        )
    elif status == 404 or status == 410:
        issue, cause, method = "source_mismatch", "the URL no longer resolves to the content", "resolve-new-url-or-alternate-source"
    elif "application/pdf" in ctype:
        issue, cause, method = "missing_structured_data", "content is a PDF", "use-pdf-extractor"
    elif content_len > 2000 and rendered_len < 200 and ("__next" in html_low or "react" in html_low or "ng-app" in html_low or "window.__" in html_low):
        issue, cause, method, risk = (
            "dynamic_rendering",
            "page renders client-side; static HTML has little text",
            "request-headless-rendering-fetcher",
            RISK_MEDIUM,
        )
    elif content_len > 0 and rendered_len < 120:
        issue, cause, method = "weak_selector", "fetched HTML but extracted almost no text", "improve-extractor-selectors"
    elif html.strip() and ("<html" not in html_low and "<body" not in html_low and "<p" not in html_low):
        issue, cause, method = "bad_html", "response is not well-formed HTML", "use-tolerant-parser-or-alternate-source"
    elif content_len == 0:
        issue, cause, method, risk = "inaccessible", "empty response body", "try-alternate-source", RISK_MEDIUM
    else:
        issue, cause, method = "missing_structured_data", "no recognisable structured data found", "improve-extractor-or-request-parser"

    needs_dev = issue in {"dynamic_rendering", "blocked_page", "missing_structured_data"}
    dev_request = None
    if issue == "dynamic_rendering":
        dev_request = {"kind": "parser", "title": "Headless/dynamic-rendering fetcher", "detail": f"{url or 'source'} renders client-side and needs a rendering fetcher."}
    elif issue == "blocked_page":
        dev_request = {"kind": "source", "title": "Alternate source / fetch strategy", "detail": f"{url or 'source'} blocks the worker; need an alternate source or fetch strategy."}
    elif issue == "missing_structured_data":
        dev_request = {"kind": "parser", "title": "Structured-data parser", "detail": f"{url or 'source'} lacks structured data the extractor understands."}

    return envelope(
        result={"issue": issue, "likely_cause": cause, "recommended_method": method, "developer_request": dev_request},
        confidence=0.75 if issue != "unknown" else 0.4,
        reasoning=f"Fetch diagnosis: {issue} — {cause}.",
        evidence=[f"http_status={status}", f"content_len={content_len}", f"rendered_len={rendered_len}"],
        sources_used=[url] if url else [],
        risk_level=risk,
        recommended_next_action=method,
        safe_to_auto_execute=not needs_dev,
    )
