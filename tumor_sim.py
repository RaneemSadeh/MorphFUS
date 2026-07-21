import numpy as np
import cv2


class SyntheticTumorPatient:

    def __init__(self, image_size=256, initial_radius_mm=18.0,
                 pixels_per_mm=4.0, seed=None):
        self.image_size = image_size
        self.radius_mm = initial_radius_mm
        self.pixels_per_mm = pixels_per_mm
        self.center = (image_size // 2 + 6, image_size // 2 - 4)
        self.rng = np.random.default_rng(seed)
        self.destroyed_fraction = 0.0  

    def apply_energy(self, power_watts, focal_radius_mm, dt_seconds):
        if focal_radius_mm <= self.radius_mm:
            coupling = 1.0
        else:
            overshoot = focal_radius_mm - self.radius_mm
            coupling = max(0.15, 1.0 - overshoot / self.radius_mm)

        ablation_rate = 0.015 * power_watts * coupling 
        shrink = ablation_rate * dt_seconds
        self.radius_mm = max(0.0, self.radius_mm - shrink)

        self.destroyed_fraction = min(1.0, self.destroyed_fraction +
                                       (shrink / (self.radius_mm + shrink + 1e-6)))
        return coupling

    def generate_frame(self):
        size = self.image_size
        img = self.rng.normal(loc=60, scale=18, size=(size, size)).astype(np.float32)
        img = cv2.GaussianBlur(img, (0, 0), sigmaX=1.2)

        r_px = self.radius_mm * self.pixels_per_mm
        if r_px > 0.5:
            mask = np.zeros((size, size), dtype=np.uint8)
            cv2.circle(mask, self.center, int(round(r_px)), 255, -1)
            tumor_region = self.rng.normal(loc=25, scale=10, size=(size, size)).astype(np.float32)
            img = np.where(mask > 0, tumor_region, img)
            cv2.circle(img.astype(np.uint8), self.center, int(round(r_px)), 200, 1)

        img = cv2.GaussianBlur(img, (0, 0), sigmaX=0.8)
        img = np.clip(img, 0, 255).astype(np.uint8)
        return img
