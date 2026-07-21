from dataclasses import dataclass


@dataclass
class ControlLimits:
    max_power_watts: float = 40.0
    min_power_watts: float = 2.0
    stop_radius_mm: float = 1.5       
    focal_margin_mm: float = -0.5     
    min_confidence_to_fire: float = 0.35  
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
        self.reference_radius_mm = initial_radius_mm  

    def compute_command(self, measurement, dt_seconds: float) -> ControlCommand:
        L = self.limits

        if not measurement.found or measurement.radius_mm <= L.stop_radius_mm:
            return ControlCommand(0.0, 0.0, False, "tumor not detected / below stop threshold -> treatment complete")

        if measurement.confidence < L.min_confidence_to_fire:
            safe_power = L.min_power_watts
            focal = max(1.0, measurement.radius_mm + L.focal_margin_mm)
            return ControlCommand(safe_power, focal, True,
                                   f"low detection confidence ({measurement.confidence:.2f}) -> power reduced to minimum")

        volume_fraction = (measurement.radius_mm / self.reference_radius_mm) ** 3
        target_power = L.min_power_watts + (L.max_power_watts - L.min_power_watts) * volume_fraction

        taper_zone = self.limits.stop_radius_mm * 4
        if measurement.radius_mm < taper_zone:
            taper = measurement.radius_mm / taper_zone
            target_power *= max(0.25, taper)

        power = float(min(L.max_power_watts, max(L.min_power_watts, target_power)))

        focal = measurement.radius_mm + L.focal_margin_mm
        focal = float(min(L.max_focal_radius_mm, max(1.0, focal)))

        return ControlCommand(power, focal, True, "nominal closed-loop adjustment")
