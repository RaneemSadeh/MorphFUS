

import argparse
import os
from pathlib import Path

import cv2
import numpy as np

from data_loader import list_ultrasound_cases, load_ultrasound_case
from detection import detect_tumor
from segmentation_model import load_model
from ultrasound_unet import load_unet_model


DEFAULT_DATA_DIR = os.path.join("Data", "02", "Radio-Freqency", "Pre-clinical _ultrasound_dataset", "all_cases")


def normalize_frame(frame: np.ndarray) -> np.ndarray:
    frame = frame.astype(np.float32)
    frame = cv2.normalize(frame, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    return np.clip(frame, 0, 255).astype(np.uint8)


def draw_overlay(frame: np.ndarray, measurement, output_path: str) -> None:
    vis = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
    if measurement.found:
        cx, cy = int(measurement.center_px[0]), int(measurement.center_px[1])
        cv2.circle(vis, (cx, cy), int(measurement.radius_px), (0, 220, 0), 1)
        cv2.circle(vis, (cx, cy), int(max(measurement.radius_px, 1)), (0, 0, 255), 1)
    label = f"found={measurement.found} r={measurement.radius_mm:.2f}mm conf={measurement.confidence:.2f}"
    cv2.putText(vis, label, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.imwrite(output_path, vis)


def main():
    parser = argparse.ArgumentParser(description="Run the prototype detector on a real ultrasound dataset slice.")
    parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR, help="Path to the ultrasound dataset all_cases directory")
    parser.add_argument("--case-id", default=None, help="Case ID to use, e.g. Cage01_BL")
    parser.add_argument("--slice-index", type=int, default=None, help="Slice index to use from the volume")
    parser.add_argument("--pixels-per-mm", type=float, default=4.0, help="Approximate pixels per mm for radius conversion")
    parser.add_argument("--model-path", default=None, help="Optional path to a saved segmentation model")
    parser.add_argument("--output-dir", default="ultrasound_replay", help="Directory to save overlay output")
    args = parser.parse_args()

    model = None
    if args.model_path:
        model_path = Path(args.model_path)
        try:
            if model_path.suffix.lower() in {".pth", ".pt"}:
                model = load_unet_model(str(model_path))
            else:
                model = load_model(str(model_path))
        except ImportError as exc:
            raise ImportError(
                f"Unable to load segmentation model from {model_path}: {exc}. "
                "If you are using a .pth model, ensure PyTorch is installed and compatible. "
                "Otherwise use a .pkl segmentation model."
            ) from exc

    cases = list_ultrasound_cases(args.data_dir)
    if not cases:
        raise RuntimeError(f"No ultrasound cases found in {args.data_dir}")

    if args.case_id:
        case = next((c for c in cases if c["case_id"] == args.case_id), None)
        if case is None:
            raise ValueError(f"Requested case_id not found: {args.case_id}")
    else:
        case = cases[0]

    loc_volume, seg_volume = load_ultrasound_case(case)
    slice_index = args.slice_index if args.slice_index is not None else loc_volume.shape[2] // 2
    if slice_index < 0 or slice_index >= loc_volume.shape[2]:
        raise ValueError(f"slice_index must be between 0 and {loc_volume.shape[2] - 1}")

    frame = loc_volume[:, :, slice_index]
    seg_mask = seg_volume[:, :, slice_index]
    frame_uint8 = normalize_frame(frame)

    measurement = detect_tumor(frame_uint8, pixels_per_mm=args.pixels_per_mm, model=model)
    os.makedirs(args.output_dir, exist_ok=True)
    overlay_path = Path(args.output_dir) / f"{case['case_id']}_slice_{slice_index:02d}_overlay.png"
    draw_overlay(frame_uint8, measurement, str(overlay_path))

    print(f"Case: {case['case_id']} ({case['label']})")
    print(f"Slice: {slice_index}")
    print(f"Frame shape: {frame.shape}")
    print(f"Detection: found={measurement.found}, radius_mm={measurement.radius_mm:.2f}, confidence={measurement.confidence:.2f}")
    print(f"Saved overlay to: {overlay_path}")

    mask_path = Path(args.output_dir) / f"{case['case_id']}_slice_{slice_index:02d}_mask.png"
    cv2.imwrite(str(mask_path), (seg_mask > 0).astype(np.uint8) * 255)
    print(f"Saved segmentation mask to: {mask_path}")


if __name__ == "__main__":
    main()
