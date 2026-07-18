"""
train_ultrasound_segmentation.py
--------------------------------
Train a baseline pixel-level ultrasound segmentation model using the uploaded
pre-clinical liver tumor dataset.
"""

import argparse
import os
import pickle
import random
from collections import Counter
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

from data_loader import list_ultrasound_cases, load_ultrasound_case
from segmentation_model import UltrasoundSegmentationModel, extract_pixel_features


DEFAULT_DATA_DIR = os.path.join("Data", "02", "Radio-Freqency", "Pre-clinical _ultrasound_dataset", "all_cases")
DEFAULT_MODEL_PATH = os.path.join("models", "ultrasound_segmentation_model.pkl")


def sample_slice_pixels(
    image: np.ndarray,
    mask: np.ndarray,
    num_samples: int = 1500,
    positive_fraction: float = 0.5,
) -> Tuple[np.ndarray, np.ndarray]:
    flat_mask = mask.reshape(-1)
    positive_idx = np.flatnonzero(flat_mask > 0)
    negative_idx = np.flatnonzero(flat_mask == 0)

    num_pos = min(len(positive_idx), int(num_samples * positive_fraction))
    num_neg = min(len(negative_idx), num_samples - num_pos)
    if num_pos == 0 or num_neg == 0:
        raise ValueError("Slice contains too few positive or negative pixels for sampling")

    chosen_pos = np.random.choice(positive_idx, size=num_pos, replace=len(positive_idx) < num_pos)
    chosen_neg = np.random.choice(negative_idx, size=num_neg, replace=len(negative_idx) < num_neg)
    chosen = np.concatenate([chosen_pos, chosen_neg])
    np.random.shuffle(chosen)

    features = extract_pixel_features(image)
    return features[chosen], flat_mask[chosen].astype(int)


def gather_training_data(
    cases: List[Dict[str, str]],
    max_samples_per_slice: int = 1500,
    positive_fraction: float = 0.5,
) -> Tuple[np.ndarray, np.ndarray]:
    X_list = []
    y_list = []
    for case in cases:
        volume, seg_volume = load_ultrasound_case(case)
        for slice_index in range(volume.shape[2]):
            image = volume[:, :, slice_index]
            mask = seg_volume[:, :, slice_index]
            try:
                X_slice, y_slice = sample_slice_pixels(image, mask, num_samples=max_samples_per_slice, positive_fraction=positive_fraction)
            except ValueError:
                continue
            X_list.append(X_slice)
            y_list.append(y_slice)

    if not X_list:
        raise RuntimeError("No training samples were gathered from the ultrasound dataset.")

    X = np.vstack(X_list)
    y = np.concatenate(y_list)
    return X, y


def predict_volume(model: UltrasoundSegmentationModel, volume: np.ndarray) -> np.ndarray:
    masks = []
    for slice_index in range(volume.shape[2]):
        mask = model.predict_mask(volume[:, :, slice_index])
        masks.append(mask)
    return np.stack(masks, axis=2)


def dice_score(predicted: np.ndarray, reference: np.ndarray) -> float:
    predicted = predicted.astype(bool)
    reference = reference.astype(bool)
    intersection = np.logical_and(predicted, reference).sum()
    total = predicted.sum() + reference.sum()
    if total == 0:
        return 1.0
    return 2.0 * intersection / total


def main():
    parser = argparse.ArgumentParser(description="Train a baseline ultrasound segmentation model on the uploaded dataset.")
    parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR, help="Path to the ultrasound dataset all_cases directory")
    parser.add_argument("--test-size", type=float, default=0.2, help="Fraction of cases to hold out for evaluation")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed for splits and sampling")
    parser.add_argument("--output-model", default=DEFAULT_MODEL_PATH, help="Path to save the trained segmentation model")
    parser.add_argument("--samples-per-slice", type=int, default=1500, help="Number of pixels to sample per slice for training")
    parser.add_argument("--positive-fraction", type=float, default=0.5, help="Fraction of sampled pixels with positive mask label")
    args = parser.parse_args()

    random.seed(args.random_state)
    np.random.seed(args.random_state)

    cases = list_ultrasound_cases(args.data_dir)
    if not cases:
        raise RuntimeError(f"No ultrasound cases found in {args.data_dir}")

    case_ids = [case["case_id"] for case in cases]
    train_ids, test_ids = train_test_split(case_ids, test_size=args.test_size, random_state=args.random_state)
    cases_by_id = {case["case_id"]: case for case in cases}
    train_cases = [cases_by_id[cid] for cid in sorted(train_ids)]
    test_cases = [cases_by_id[cid] for cid in sorted(test_ids)]

    print("Training cases:", [case["case_id"] for case in train_cases])
    print("Testing cases:", [case["case_id"] for case in test_cases])

    X_train, y_train = gather_training_data(train_cases, max_samples_per_slice=args.samples_per_slice, positive_fraction=args.positive_fraction)
    print(f"Training samples: {X_train.shape[0]}, features: {X_train.shape[1]}")
    print("Label distribution:", Counter(y_train))

    classifier = HistGradientBoostingClassifier(loss="log_loss", max_iter=200, random_state=args.random_state)
    classifier.fit(X_train, y_train)

    model = UltrasoundSegmentationModel(classifier)
    os.makedirs(os.path.dirname(args.output_model), exist_ok=True)
    with open(args.output_model, "wb") as f:
        pickle.dump(model, f)

    print(f"Saved segmentation model to {args.output_model}")

    dice_scores = []
    for case in test_cases:
        volume, seg_volume = load_ultrasound_case(case)
        predicted = predict_volume(model, volume)
        dice = dice_score(predicted, seg_volume)
        dice_scores.append(dice)
        print(f"Case {case['case_id']}: dice={dice:.4f}")

    if dice_scores:
        print(f"Mean test dice: {np.mean(dice_scores):.4f}")

    y_pred = classifier.predict(X_train)
    print("Training classification report")
    print(classification_report(y_train, y_pred, digits=4))


if __name__ == "__main__":
    main()
