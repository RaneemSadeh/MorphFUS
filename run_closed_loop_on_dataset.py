"""
run_closed_loop_on_dataset.py
-----------------------------
Replay real ultrasound dataset slices through the closed-loop detection +
controller pipeline.

This script demonstrates how the existing control logic behaves when real
ultrasound image frames are provided as the input stream instead of synthetic
frames from `tumor_sim.py`.
"""

import argparse
import csv
import os
from pathlib import Path

import cv2
import matplotlib.pyplot as plt
import numpy as np

from controller import AdaptiveController, ControlLimits
from data_loader import list_ultrasound_cases, load_ultrasound_case
from detection import detect_tumor
from segmentation_model import load_model
from ultrasound_unet import load_unet_model


DEFAULT_DATA_DIR = os.path.join("Data", "02", "Radio-Freqency", "Pre-clinical _ultrasound_dataset", "all_cases")


def normalize_frame(frame: np.ndarray) -> np.ndarray:
    frame = frame.astype(np.float32)
    frame = cv2.normalize(frame, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    return np.clip(frame, 0, 255).astype(np.uint8)


def draw_overlay(frame: np.ndarray, measurement, command, output_path: str) -> None:
    vis = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
    if measurement.found:
        cx, cy = int(measurement.center_px[0]), int(measurement.center_px[1])
        cv2.circle(vis, (cx, cy), int(measurement.radius_px), (0, 220, 0), 1)
        focal_px = int(max(command.focal_radius_mm * 4.0, 1))
        cv2.circle(vis, (cx, cy), focal_px, (0, 0, 255), 1)
    label = f"t={command.power_watts:.1f}W f={command.focal_radius_mm:.1f}mm conf={measurement.confidence:.2f}"
    cv2.putText(vis, label, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.imwrite(output_path, vis)


def main():
    parser = argparse.ArgumentParser(description="Run the closed-loop controller on real ultrasound dataset slices.")
    parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR, help="Path to ultrasound dataset all_cases directory")
    parser.add_argument("--case-id", default=None, help="Case ID to use, e.g. Cage01_BL")
    parser.add_argument("--slice-step", type=int, default=1, help="Step between slices to replay")
    parser.add_argument("--max-slices", type=int, default=None, help="Maximum number of slices to process")
    parser.add_argument("--pixels-per-mm", type=float, default=4.0, help="Approximate pixels per mm for radius conversion")
    parser.add_argument("--dt", type=float, default=0.5, help="Seconds per control cycle")
    parser.add_argument("--model-path", default=None, help="Optional path to a saved segmentation model (.pkl or .pth)")
    parser.add_argument("--output-dir", default="dataset_closed_loop", help="Directory to save outputs")
    parser.add_argument("--save-every", type=int, default=5, help="Save overlay images every N slices")
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

    volume, _ = load_ultrasound_case(case)
    slice_indices = list(range(0, volume.shape[2], args.slice_step))
    if args.max_slices is not None:
        slice_indices = slice_indices[: args.max_slices]

    os.makedirs(args.output_dir, exist_ok=True)
    log_path = Path(args.output_dir) / f"{case['case_id']}_closed_loop_log.csv"
    overlays_dir = Path(args.output_dir) / "frames"
    overlays_dir.mkdir(exist_ok=True)

    limits = ControlLimits(max_power_watts=40.0, min_power_watts=2.0, stop_radius_mm=1.5)
    controller = AdaptiveController(limits=limits, initial_radius_mm=18.0)

    rows = []
    for idx, slice_index in enumerate(slice_indices):
        frame = volume[:, :, slice_index]
        frame_uint8 = normalize_frame(frame)
        measurement = detect_tumor(frame_uint8, pixels_per_mm=args.pixels_per_mm, model=model)
        command = controller.compute_command(measurement, dt_seconds=args.dt)

        rows.append({
            "t_s": round(idx * args.dt, 3),
            "slice_index": slice_index,
            "case_id": case["case_id"],
            "label": case["label"],
            "found": measurement.found,
            "measured_radius_mm": round(measurement.radius_mm, 3),
            "confidence": round(measurement.confidence, 3),
            "power_w": round(command.power_watts, 3),
            "focal_radius_mm": round(command.focal_radius_mm, 3),
            "reason": command.reason,
        })

        if args.save_every > 0 and idx % args.save_every == 0:
            overlay_path = overlays_dir / f"{case['case_id']}_slice_{slice_index:03d}.png"
            draw_overlay(frame_uint8, measurement, command, str(overlay_path))

    with open(log_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    ts = [r["t_s"] for r in rows]
    radii = [r["measured_radius_mm"] for r in rows]
    power = [r["power_w"] for r in rows]
    focal = [r["focal_radius_mm"] for r in rows]

    fig, axes = plt.subplots(3, 1, figsize=(8, 9), sharex=True)
    axes[0].plot(ts, radii, color="#1b7a3d")
    axes[0].set_ylabel("measured radius (mm)")
    axes[0].set_title(f"Closed-loop replay on dataset case {case['case_id']}")
    axes[1].plot(ts, power, color="#b3401f")
    axes[1].set_ylabel("command power (W)")
    axes[2].plot(ts, focal, color="#2255aa")
    axes[2].set_ylabel("command focal radius (mm)")
    axes[2].set_xlabel("time (s)")
    for ax in axes:
        ax.grid(alpha=0.25)
    plt.tight_layout()

    summary_path = Path(args.output_dir) / f"{case['case_id']}_closed_loop_summary.png"
    plt.savefig(summary_path, dpi=150)

    print(f"Processed {len(rows)} slices for case {case['case_id']}")
    print(f"Wrote log to {log_path}")
    print(f"Saved summary plot to {summary_path}")
    print(f"Saved overlays to {overlays_dir}")


if __name__ == "__main__":
    main()
