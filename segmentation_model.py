
from __future__ import annotations

import pickle
from typing import Any, Dict, Optional

import cv2
import numpy as np


def normalize_frame(frame: np.ndarray) -> np.ndarray:
    frame = frame.astype(np.float32)
    if frame.max() == frame.min():
        return np.zeros_like(frame, dtype=np.uint8)
    normalized = (frame - frame.min()) / (frame.max() - frame.min()) * 255.0
    return np.clip(normalized, 0, 255).astype(np.uint8)


def extract_pixel_features(frame: np.ndarray) -> np.ndarray:
    """Extract a pixel-level feature vector for each pixel in a 2D ultrasound frame."""
    frame = normalize_frame(frame).astype(np.float32)
    features = [frame.reshape(-1, 1)]

    for ksize in (3, 5, 7):
        kernel = np.ones((ksize, ksize), np.float32) / (ksize * ksize)
        mean = cv2.filter2D(frame, -1, kernel)
        features.append(mean.reshape(-1, 1))

    sobel_x = cv2.Sobel(frame, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(frame, cv2.CV_32F, 0, 1, ksize=3)
    grad = np.sqrt(sobel_x ** 2 + sobel_y ** 2)
    features.append(grad.reshape(-1, 1))

    laplacian = cv2.Laplacian(frame, cv2.CV_32F)
    features.append(laplacian.reshape(-1, 1))

    return np.concatenate(features, axis=1)


class UltrasoundSegmentationModel:
    def __init__(self, pipeline: Any):
        self.pipeline = pipeline

    def predict_mask(self, frame: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        frame = normalize_frame(frame)
        features = extract_pixel_features(frame)
        if hasattr(self.pipeline, "predict_proba"):
            probs = self.pipeline.predict_proba(features)
            if probs.shape[1] == 1:
                scores = probs[:, 0]
            else:
                scores = probs[:, 1]
        else:
            scores = self.pipeline.predict(features).astype(float)
        mask = (scores.reshape(frame.shape) >= threshold).astype(np.uint8)
        return mask


def save_model(model: UltrasoundSegmentationModel, path: str) -> None:
    with open(path, "wb") as f:
        pickle.dump(model, f)


def load_model(path: str) -> UltrasoundSegmentationModel:
    with open(path, "rb") as f:
        loaded = pickle.load(f)
    if not isinstance(loaded, UltrasoundSegmentationModel):
        raise ValueError(f"Loaded object is not an UltrasoundSegmentationModel: {path}")
    return loaded
