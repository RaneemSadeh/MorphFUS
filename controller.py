"""
controller.py
-------------
The actual "closed loop" logic your project is about: takes a real-time
tumor measurement and decides what ultrasound power and focal spot size
to apply next, then ramps down / stops automatically as the tumor shrinks.

This is a control-systems problem sitting on top of a perception problem:
  measurement (detection.py) -> decision (this file) -> actuation (sim) -> repeat

Design choices worth defending in a report/thesis:
  - Focal spot size tracks tumor radius with a small negative margin, so
    the beam shrinks together with the tumor instead of continuing to
    irradiate a fixed volume of healthy tissue that used to be tumor.
  - Power is proportional to remaining tumor area (more tissue left =
    more energy budget) but is HARD CAPPED, and decays as radius
    approaches a stopping threshold, to avoid overshooting into healthy
    margin as the target gets small and detection noise gets relatively
    larger.
  - A confidence gate: if the detector's confidence drops (noisy frame,
    partial occlusion, motion blur) power is reduced or paused rather
    than trusting a bad measurement -- this is the safety-critical part
    a real system absolutely needs, and a good thing to highlight when
    presenting this prototype.
"""

from dataclasses import dataclass


@dataclass
class ControlLimits:
    max_power_watts: float = 40.0
    min_power_watts: float = 2.0
    stop_radius_mm: float = 1.5          # below this, consider tumor ablated
    focal_margin_mm: float = -0.5        # negative = focal spot slightly SMALLER than tumor
    min_confidence_to_fire: float = 0.35  # below this, don't fire full power
    max_focal_radius_mm: float = 25.0


@dataclass
class ControlCommand:
    power_watts: float
    focal_radius_mm: float
    fire: bool
    reason: str


class AdaptiveController:
    def __init__(self, limits: ControlLimits = None, initial_radius_mm: float = 18.0):
        self.limits = limits or ControlLimits()
        self.reference_radius_mm = initial_radius_mm  # size at treatment start, for scaling power

    def compute_command(self, measurement, dt_seconds: float) -> ControlCommand:
        L = self.limits

        if not measurement.found or measurement.radius_mm <= L.stop_radius_mm:
            return ControlCommand(0.0, 0.0, False, "tumor not detected / below stop threshold -> treatment complete")

        if measurement.confidence < L.min_confidence_to_fire:
            # low-confidence read: don't blast tissue based on a shaky measurement
            safe_power = L.min_power_watts
            focal = max(1.0, measurement.radius_mm + L.focal_margin_mm)
            return ControlCommand(safe_power, focal, True,
                                   f"low detection confidence ({measurement.confidence:.2f}) -> power reduced to minimum")

        # proportional power law: scale with remaining tumor volume fraction
        volume_fraction = (measurement.radius_mm / self.reference_radius_mm) ** 3
        target_power = L.min_power_watts + (L.max_power_watts - L.min_power_watts) * volume_fraction

        # taper power as we approach stop threshold, so the last bit of
        # tumor is finished off gently rather than overshot
        taper_zone = self.limits.stop_radius_mm * 4
        if measurement.radius_mm < taper_zone:
            taper = measurement.radius_mm / taper_zone
            target_power *= max(0.25, taper)

        power = float(min(L.max_power_watts, max(L.min_power_watts, target_power)))

        focal = measurement.radius_mm + L.focal_margin_mm
        focal = float(min(L.max_focal_radius_mm, max(1.0, focal)))

        return ControlCommand(power, focal, True, "nominal closed-loop adjustment")
