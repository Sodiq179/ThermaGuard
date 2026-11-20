"""Worker-level attention scoring (PMS-style, simplified, without heart rate).

A zero-order Sugeno fuzzy system: each input is fuzzified with a linear ramp into a
"risky" membership in [0, 1]; a small rule base combines the memberships; the score is
the firing-strength-weighted average of the rule outputs (0-100).

This is decision support for supervisors, not a medical assessment.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from .thresholds import Thresholds


@dataclass(frozen=True)
class AttentionInputs:
    on_shift: bool
    on_break: bool
    skin_temp_c: Optional[float]
    skin_trend_c_per_10min: Optional[float]
    continuous_exposure_min: float
    allowed_work_min: Optional[int]  # from the zone work-rest recommendation; 0 = stop work
    wbgt_c: Optional[float]
    intensity: str


@dataclass(frozen=True)
class Factor:
    key: str
    label: str
    detail: str
    score: float


@dataclass(frozen=True)
class AttentionResult:
    score: float
    level: str
    label: str
    summary: str
    factors: List[Factor] = field(default_factory=list)


LEVEL_LABELS = {"normal": "Normal", "watch": "Watch", "attention": "Attention", "act_now": "Act now"}

# Rule base: antecedent -> output score. Fuzzy AND = min, NOT = 1 - x. Single-input rules
# exclude the combined case so a compound rule is not diluted by its own parts.
RULE_OUTPUTS = {
    "skin_and_trend": 95.0,
    "skin": 85.0,
    "heat_and_exposure": 80.0,
    "heat": 55.0,
    "exposure": 45.0,
    "trend": 40.0,
    "calm": 5.0,
}


def _level(score: float, t: Thresholds) -> str:
    a = t.attention
    if score >= a.level_act_now:
        return "act_now"
    if score >= a.level_attention:
        return "attention"
    if score >= a.level_watch:
        return "watch"
    return "normal"


def _exposure_ratio(minutes: float, allowed: Optional[int]) -> float:
    if allowed is None:
        return 0.0
    if allowed == 0:
        return 2.0 if minutes > 0 else 0.0
    # Continuous work (60 min/h) is judged against a 90-minute reference stretch.
    reference = 90.0 if allowed >= 60 else float(allowed)
    return minutes / reference


def evaluate(inputs: AttentionInputs, t: Thresholds) -> AttentionResult:
    if not inputs.on_shift:
        return AttentionResult(0.0, "normal", LEVEL_LABELS["normal"], "Not checked in to a zone.")

    cfg = t.attention
    factors: List[Factor] = []

    skin = 0.0
    if inputs.skin_temp_c is not None:
        skin = cfg.skin_temp.membership(inputs.skin_temp_c)
        if inputs.skin_temp_c >= cfg.skin_act_c:
            note = f"above the {cfg.skin_act_c:.1f} °C action level"
        elif inputs.skin_temp_c >= cfg.skin_watch_c:
            note = f"above the {cfg.skin_watch_c:.1f} °C watch level"
        else:
            note = "within the normal range"
        factors.append(Factor("skin_temp", "Skin temperature", f"{inputs.skin_temp_c:.1f} °C, {note}", skin))

    trend = 0.0
    if inputs.skin_trend_c_per_10min is not None:
        trend = cfg.skin_trend.membership(inputs.skin_trend_c_per_10min)
        direction = "rising" if inputs.skin_trend_c_per_10min > 0.05 else (
            "falling" if inputs.skin_trend_c_per_10min < -0.05 else "stable"
        )
        factors.append(
            Factor(
                "skin_trend",
                "Skin temperature trend",
                f"{inputs.skin_trend_c_per_10min:+.2f} °C per 10 min ({direction})",
                trend,
            )
        )

    exposure = 0.0
    if not inputs.on_break:
        ratio = _exposure_ratio(inputs.continuous_exposure_min, inputs.allowed_work_min)
        exposure = cfg.exposure_ratio.membership(ratio)
        if inputs.allowed_work_min == 0:
            detail = f"{inputs.continuous_exposure_min:.0f} min working while the zone requires a stop"
        elif inputs.allowed_work_min is not None and inputs.allowed_work_min < 60:
            detail = (
                f"{inputs.continuous_exposure_min:.0f} min without a break "
                f"(recommended max {inputs.allowed_work_min} min)"
            )
        else:
            detail = f"{inputs.continuous_exposure_min:.0f} min without a break"
    else:
        detail = "On break, exposure clock paused"
    factors.append(Factor("exposure", "Continuous exposure", detail, exposure))

    heat = 0.0
    if inputs.wbgt_c is not None:
        reference = t.continuous_reference_c[inputs.intensity]
        delta = inputs.wbgt_c - reference
        heat = cfg.heat_load.membership(delta)
        if inputs.on_break:
            heat *= 0.3  # resting in shade sharply reduces metabolic heat load
        relation = "over" if delta > 0 else "under"
        factors.append(
            Factor(
                "heat_load",
                "Heat load for work intensity",
                f"WBGT {inputs.wbgt_c:.1f} °C, {abs(delta):.1f} °C {relation} the {inputs.intensity}-work reference",
                heat,
            )
        )

    strengths: List[Tuple[str, float]] = [
        ("skin_and_trend", min(skin, trend)),
        ("skin", skin),
        ("heat_and_exposure", min(heat, exposure)),
        ("heat", min(heat, 1.0 - exposure)),
        ("exposure", min(exposure, 1.0 - heat)),
        ("trend", min(trend, 1.0 - skin)),
        ("calm", 1.0 - max(skin, trend, heat, exposure)),
    ]
    total = sum(w for _, w in strengths)
    sugeno = sum(w * RULE_OUTPUTS[name] for name, w in strengths) / total if total > 0 else 0.0
    # A fully fired high-priority rule must not be diluted by weaker ones (safety-first).
    dominant = max(w * RULE_OUTPUTS[name] for name, w in strengths)
    score = max(sugeno, dominant)
    score = round(max(0.0, min(100.0, score)), 1)
    level = _level(score, t)

    factors = sorted(
        (Factor(f.key, f.label, f.detail, round(f.score * 100, 1)) for f in factors),
        key=lambda f: f.score,
        reverse=True,
    )

    drivers = [f.label.lower() for f in factors if f.score >= 50]
    if level == "normal":
        summary = "No concerning signals."
    elif drivers:
        summary = "Driven by " + ", ".join(drivers) + "."
    else:
        summary = "Several signals are elevated at the same time."
    if inputs.skin_temp_c is None:
        summary += " No harness data, score uses zone conditions only."

    return AttentionResult(score, level, LEVEL_LABELS[level], summary, factors)
