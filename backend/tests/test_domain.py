"""Unit tests for the heat-stress decision logic."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.domain import attention, exposure, wbgt, work_rest
from app.domain.thresholds import Ramp

NOW = datetime(2026, 7, 1, 9, 0, tzinfo=timezone.utc)


# ----------------------------------------------------------------------------- WBGT
def test_wbgt_with_globe_matches_iso_formula():
    result = wbgt.compute_wbgt(air_temp_c=35.0, rh_pct=40.0, globe_temp_c=50.0)
    tnw = wbgt.natural_wet_bulb_c(35.0, 40.0, 50.0)
    assert result.estimated is False
    assert result.wbgt_c == pytest.approx(0.7 * tnw + 0.2 * 50.0 + 0.1 * 35.0, abs=0.01)


def test_stull_wet_bulb_reference_value():
    # Stull (2011) reference: 20 °C, 50 % RH -> 13.7 °C
    assert wbgt.psychrometric_wet_bulb_c(20.0, 50.0) == pytest.approx(13.7, abs=0.1)


def test_wbgt_without_globe_is_estimated_and_rises_with_humidity():
    dry = wbgt.compute_wbgt(38.0, 20.0, None)
    humid = wbgt.compute_wbgt(38.0, 60.0, None)
    assert dry.estimated and humid.estimated
    assert humid.wbgt_c > dry.wbgt_c


def test_heat_index_exceeds_air_temp_when_hot_and_humid():
    assert wbgt.heat_index_c(35.0, 60.0) > 40.0


# ----------------------------------------------------------------------------- work-rest
@pytest.mark.parametrize(
    "value,key", [(22.0, "low"), (26.5, "moderate"), (29.0, "high"), (31.0, "very_high"), (33.0, "extreme")]
)
def test_band_classification(thresholds, value, key):
    assert work_rest.classify_band(value, thresholds).key == key


@pytest.mark.parametrize(
    "value,intensity,work,stop",
    [
        (27.0, "moderate", 60, False),
        (28.5, "moderate", 45, False),
        (29.5, "moderate", 30, False),
        (31.0, "moderate", 15, False),
        (32.0, "moderate", 0, True),
        (27.0, "heavy", 45, False),
        (30.0, "heavy", 15, False),
        (31.0, "heavy", 0, True),
        (31.0, "light", 60, False),
    ],
)
def test_acgih_work_rest_lookup(thresholds, value, intensity, work, stop):
    rec = work_rest.recommend(value, intensity, thresholds)
    assert rec.work_minutes == work
    assert rec.stop_work is stop
    assert rec.work_minutes + rec.rest_minutes == 60


# ----------------------------------------------------------------------------- attention
def _inputs(**overrides):
    base = dict(
        on_shift=True, on_break=False, skin_temp_c=34.0, skin_trend_c_per_10min=0.0,
        continuous_exposure_min=10, allowed_work_min=60, wbgt_c=24.0, intensity="moderate",
    )
    base.update(overrides)
    return attention.AttentionInputs(**base)


def test_calm_conditions_score_normal(thresholds):
    result = attention.evaluate(_inputs(), thresholds)
    assert result.level == "normal"
    assert result.score < 25


def test_hot_skin_with_rising_trend_is_act_now(thresholds):
    result = attention.evaluate(_inputs(skin_temp_c=37.6, skin_trend_c_per_10min=1.2), thresholds)
    assert result.level == "act_now"
    assert result.factors[0].key in {"skin_temp", "skin_trend"}


def test_heat_and_long_exposure_raise_attention_without_skin_data(thresholds):
    result = attention.evaluate(
        _inputs(skin_temp_c=None, skin_trend_c_per_10min=None, wbgt_c=31.5, continuous_exposure_min=40,
                allowed_work_min=15),
        thresholds,
    )
    assert result.level in {"attention", "act_now"}
    assert "No harness data" in result.summary


def test_break_reduces_score(thresholds):
    working = attention.evaluate(_inputs(wbgt_c=30.5, continuous_exposure_min=50, allowed_work_min=30), thresholds)
    resting = attention.evaluate(
        _inputs(wbgt_c=30.5, continuous_exposure_min=0, allowed_work_min=30, on_break=True), thresholds
    )
    assert resting.score < working.score


def test_off_shift_is_normal(thresholds):
    assert attention.evaluate(_inputs(on_shift=False, skin_temp_c=38.0), thresholds).level == "normal"


def test_ramp_membership_is_clamped():
    ramp = Ramp(0.0, 10.0)
    assert ramp.membership(-5) == 0.0
    assert ramp.membership(5) == 0.5
    assert ramp.membership(50) == 1.0


# ----------------------------------------------------------------------------- exposure
def test_exposure_continuous_and_total():
    segments = [
        exposure.Segment("work", NOW - timedelta(minutes=90), NOW - timedelta(minutes=60)),
        exposure.Segment("break", NOW - timedelta(minutes=60), NOW - timedelta(minutes=45)),
        exposure.Segment("work", NOW - timedelta(minutes=45), None),
    ]
    summary = exposure.summarize(segments, NOW)
    assert summary.continuous_min == pytest.approx(45)
    assert summary.total_min == pytest.approx(75)
    assert summary.break_elapsed_min is None


def test_exposure_on_break():
    segments = [
        exposure.Segment("work", NOW - timedelta(minutes=40), NOW - timedelta(minutes=10)),
        exposure.Segment("break", NOW - timedelta(minutes=10), None),
    ]
    summary = exposure.summarize(segments, NOW)
    assert summary.continuous_min == 0
    assert summary.break_elapsed_min == pytest.approx(10)


def test_skin_trend_slope():
    samples = [(NOW + timedelta(minutes=i), 34.0 + 0.05 * i) for i in range(10)]
    assert exposure.skin_trend_per_10min(samples) == pytest.approx(0.5, abs=0.01)
    assert exposure.skin_trend_per_10min(samples[:2]) is None


@pytest.mark.parametrize("temp,state", [(None, "unknown"), (24.0, "ok"), (28.5, "melting"), (31.0, "spent")])
def test_pcm_state(thresholds, temp, state):
    assert exposure.pcm_state(temp, thresholds) == state


def test_midday_ban_window(thresholds):
    cfg = thresholds.midday_ban
    noon_july = datetime(2026, 7, 1, 10, 30, tzinfo=timezone.utc)  # 13:30 Riyadh
    assert exposure.midday_ban_status(noon_july, cfg) == (True, True)
    morning_july = datetime(2026, 7, 1, 5, 0, tzinfo=timezone.utc)  # 08:00 Riyadh
    assert exposure.midday_ban_status(morning_july, cfg) == (False, True)
    noon_november = datetime(2026, 11, 20, 10, 30, tzinfo=timezone.utc)
    assert exposure.midday_ban_status(noon_november, cfg) == (False, False)


def test_dominant_rule_is_not_diluted_by_weaker_signals(thresholds):
    result = attention.evaluate(
        _inputs(wbgt_c=33.0, continuous_exposure_min=70, allowed_work_min=0, skin_trend_c_per_10min=0.45),
        thresholds,
    )
    assert result.level == "act_now"
