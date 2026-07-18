"""
tumor_sim.py
------------
Synthetic ultrasound-frame generator for prototyping the closed-loop
detection <-> ablation control system.

This is a STAND-IN for real ultrasound frames. It exists so the rest of
the pipeline (detection.py, controller.py) can be built and tested without
needing a live ultrasound feed or a downloaded dataset yet.

To swap in real data later: replace `generate_frame()` calls with a
function that loads/reads the next frame from your dataset or a live
ultrasound stream, and feed it into the same `detect_tumor()` function
in detection.py. Nothing downstream needs to change.
"""

import numpy as np
import cv2


class SyntheticTumorPatient:
    """
    Simulates a tumor sitting in noisy ultrasound-like tissue.
    The tumor has a true physical radius (in mm) that shrinks in response
    to applied acoustic energy, plus natural texture/speckle noise typical
    of B-mode ultrasound.
    """

    def __init__(self, image_size=256, initial_radius_mm=18.0,
                 pixels_per_mm=4.0, seed=None):
        self.image_size = image_size
        self.radius_mm = initial_radius_mm
        self.pixels_per_mm = pixels_per_mm
        self.center = (image_size // 2 + 6, image_size // 2 - 4)
        self.rng = np.random.default_rng(seed)
        self.destroyed_fraction = 0.0  # 0 = untreated, 1 = fully ablated

    def apply_energy(self, power_watts, focal_radius_mm, dt_seconds):
        """
        Very simplified thermal-dose-ish model:
        shrinkage rate depends on how well the focal spot matches the
        tumor size (too small = slow, too big = wastes energy on margin
        but doesn't damage tumor faster) and on power.
        This is NOT a validated bioheat model -- it's a placeholder so the
        control loop has something to react to. Swap for a real bioheat /
        thermal dose model (e.g. CEM43) before this touches real planning.
        """
        # coupling efficiency: 1.0 if focal spot <= tumor radius, falls
        # off if focal spot is oversized (energy spills into healthy tissue
        # instead of concentrating in tumor)
        if focal_radius_mm <= self.radius_mm:
            coupling = 1.0
        else:
            overshoot = focal_radius_mm - self.radius_mm
            coupling = max(0.15, 1.0 - overshoot / self.radius_mm)

        ablation_rate = 0.015 * power_watts * coupling  # mm shrink per second
        shrink = ablation_rate * dt_seconds
        self.radius_mm = max(0.0, self.radius_mm - shrink)

        # fraction of original volume destroyed, just for logging/UI
        self.destroyed_fraction = min(1.0, self.destroyed_fraction +
                                       (shrink / (self.radius_mm + shrink + 1e-6)))
        return coupling

    def generate_frame(self):
        """Render a synthetic B-mode-style ultrasound frame with speckle noise."""
        size = self.image_size
        img = self.rng.normal(loc=60, scale=18, size=(size, size)).astype(np.float32)
        img = cv2.GaussianBlur(img, (0, 0), sigmaX=1.2)

        r_px = self.radius_mm * self.pixels_per_mm
        if r_px > 0.5:
            mask = np.zeros((size, size), dtype=np.uint8)
            cv2.circle(mask, self.center, int(round(r_px)), 255, -1)
            tumor_region = self.rng.normal(loc=25, scale=10, size=(size, size)).astype(np.float32)
            img = np.where(mask > 0, tumor_region, img)
            # thin brighter rim (typical of tumor boundary echogenicity)
            cv2.circle(img.astype(np.uint8), self.center, int(round(r_px)), 200, 1)

        img = cv2.GaussianBlur(img, (0, 0), sigmaX=0.8)
        img = np.clip(img, 0, 255).astype(np.uint8)
        return img
