from dataclasses import dataclass
from typing import Optional, Any
import numpy as np
import cv2


@dataclass
class TumorMeasurement:
    found: bool
    center_px: Optional[tuple]
    radius_px: float
    radius_mm: float
    area_mm2: float
    contour: Optional[np.ndarray]
    confidence: float  # crude proxy


def detect_tumor(frame: np.ndarray, pixels_per_mm: float, model: Optional[Any] = None) -> TumorMeasurement:
    if model is not None:
        mask = model.predict_mask(frame)
        contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return TumorMeasurement(False, None, 0.0, 0.0, 0.0, None, 0.0)

        largest = max(contours, key=cv2.contourArea)
        area_px = cv2.contourArea(largest)
        if area_px < 15:
            return TumorMeasurement(False, None, 0.0, 0.0, 0.0, None, 0.0)

        (cx, cy), radius_px = cv2.minEnclosingCircle(largest)
        perimeter = cv2.arcLength(largest, True)
        circularity = 4 * np.pi * area_px / (perimeter ** 2 + 1e-6)
        confidence = float(np.clip(circularity, 0, 1))

        radius_mm = radius_px / pixels_per_mm
        area_mm2 = np.pi * radius_mm ** 2
        return TumorMeasurement(
            found=True,
            center_px=(cx, cy),
            radius_px=radius_px,
            radius_mm=radius_mm,
            area_mm2=area_mm2,
            contour=largest,
            confidence=confidence,
        )
    else:

        denoised = cv2.bilateralFilter(frame, d=7, sigmaColor=40, sigmaSpace=40)

        _, thresh = cv2.threshold(denoised, 45, 255, cv2.THRESH_BINARY_INV)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return TumorMeasurement(False, None, 0.0, 0.0, 0.0, None, 0.0)

    largest = max(contours, key=cv2.contourArea)
    area_px = cv2.contourArea(largest)
    if area_px < 15: 
        return TumorMeasurement(False, None, 0.0, 0.0, 0.0, None, 0.0)

    (cx, cy), radius_px = cv2.minEnclosingCircle(largest)
    perimeter = cv2.arcLength(largest, True)
    circularity = 4 * np.pi * area_px / (perimeter ** 2 + 1e-6)
    confidence = float(np.clip(circularity, 0, 1))

    radius_mm = radius_px / pixels_per_mm
    area_mm2 = np.pi * radius_mm ** 2

    return TumorMeasurement(
        found=True,
        center_px=(cx, cy),
        radius_px=radius_px,
        radius_mm=radius_mm,
        area_mm2=area_mm2,
        contour=largest,
        confidence=confidence,
    )
