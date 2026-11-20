"""Thermal environment calculations.

* WBGT follows ISO 7243 (outdoor, solar load): ``0.7·Tnw + 0.2·Tg + 0.1·Ta``.
* When a station has no globe thermometer, WBGT is estimated from air temperature and
  humidity with the Australian Bureau of Meteorology approximation
  ``0.567·Ta + 0.393·e + 3.94`` (``e`` = water vapour pressure, hPa). Results computed this
  way are flagged as estimated so supervisors know their precision is lower.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class WbgtResult:
    wbgt_c: float
    estimated: bool


def vapour_pressure_hpa(air_temp_c: float, rh_pct: float) -> float:
    """Actual water vapour pressure using the Magnus formula."""
    saturation = 6.105 * math.exp(17.27 * air_temp_c / (237.7 + air_temp_c))
    return rh_pct / 100.0 * saturation


def psychrometric_wet_bulb_c(air_temp_c: float, rh_pct: float) -> float:
    """Stull (2011) empirical wet-bulb temperature, valid for RH 5-99 % and -20..50 °C."""
    t, rh = air_temp_c, max(5.0, min(99.0, rh_pct))
    return (
        t * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(t + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * rh**1.5 * math.atan(0.023101 * rh)
        - 4.686035
    )


def natural_wet_bulb_c(air_temp_c: float, rh_pct: float, globe_temp_c: float) -> float:
    """Approximate natural (unventilated) wet-bulb temperature.

    The natural wet bulb runs warmer than the psychrometric one under radiant load;
    a small radiant correction based on the globe excess keeps the estimate realistic.
    """
    radiant_excess = max(0.0, globe_temp_c - air_temp_c)
    return psychrometric_wet_bulb_c(air_temp_c, rh_pct) + 0.1 * radiant_excess


def compute_wbgt(air_temp_c: float, rh_pct: float, globe_temp_c: Optional[float]) -> WbgtResult:
    if globe_temp_c is not None:
        tnw = natural_wet_bulb_c(air_temp_c, rh_pct, globe_temp_c)
        value = 0.7 * tnw + 0.2 * globe_temp_c + 0.1 * air_temp_c
        return WbgtResult(wbgt_c=round(value, 2), estimated=False)
    e = vapour_pressure_hpa(air_temp_c, rh_pct)
    value = 0.567 * air_temp_c + 0.393 * e + 3.94
    return WbgtResult(wbgt_c=round(value, 2), estimated=True)


def heat_index_c(air_temp_c: float, rh_pct: float) -> float:
    """NOAA heat index (Rothfusz regression with Steadman fallback), in °C."""
    t_f = air_temp_c * 9 / 5 + 32
    rh = rh_pct
    simple = 0.5 * (t_f + 61.0 + (t_f - 68.0) * 1.2 + rh * 0.094)
    if (simple + t_f) / 2 < 80:
        hi_f = simple
    else:
        hi_f = (
            -42.379
            + 2.04901523 * t_f
            + 10.14333127 * rh
            - 0.22475541 * t_f * rh
            - 0.00683783 * t_f * t_f
            - 0.05481717 * rh * rh
            + 0.00122874 * t_f * t_f * rh
            + 0.00085282 * t_f * rh * rh
            - 0.00000199 * t_f * t_f * rh * rh
        )
        if rh < 13 and 80 <= t_f <= 112:
            hi_f -= ((13 - rh) / 4) * math.sqrt((17 - abs(t_f - 95)) / 17)
        elif rh > 85 and 80 <= t_f <= 87:
            hi_f += ((rh - 85) / 10) * ((87 - t_f) / 5)
    return round((hi_f - 32) * 5 / 9, 1)
