import argparse
import os
from pathlib import Path

import matplotlib.pyplot as plt

from data_loader import list_ultrasound_cases, load_ultrasound_case


DEFAULT_DATA_DIR = os.path.join("Data", "02", "Radio-Freqency", "Pre-clinical _ultrasound_dataset", "all_cases")


def normalize_slice(slice_data):
    normalized = (slice_data.astype(float) - float(slice_data.min()))
    if normalized.max() > 0:
        normalized = normalized / normalized.max() * 255.0
    return normalized.astype('uint8')


def save_case_slice(volume, seg, case_id, slice_index, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    frame_path = Path(output_dir) / f"{case_id}_slice_{slice_index:02d}.png"
    seg_path = Path(output_dir) / f"{case_id}_slice_{slice_index:02d}_mask.png"

    frame_image = normalize_slice(volume[:, :, slice_index])
    seg_image = (seg[:, :, slice_index] > 0).astype('uint8') * 255
    plt.imsave(frame_path, frame_image, cmap="gray")
    plt.imsave(seg_path, seg_image, cmap="gray")
    return frame_path, seg_path


def main():
    parser = argparse.ArgumentParser(description="Load ultrasound cases and export sample slices for inspection.")
    parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR, help="Path to the ultrasound dataset all_cases directory")
    parser.add_argument("--case-id", default=None, help="Case ID to extract (example: Cage01_BL). If omitted, the first case is used.")
    parser.add_argument("--slice-index", type=int, default=None, help="Slice index to export. Default is the middle slice.")
    parser.add_argument("--output-dir", default="ultrasound_samples", help="Directory to save exported sample images")
    args = parser.parse_args()

    cases = list_ultrasound_cases(args.data_dir)
    if not cases:
        raise RuntimeError(f"No ultrasound cases found in {args.data_dir}")

    cases_by_id = {case["case_id"]: case for case in cases}
    if args.case_id:
        if args.case_id not in cases_by_id:
            raise ValueError(f"Requested case_id not found: {args.case_id}")
        case = cases_by_id[args.case_id]
    else:
        case = cases[0]

    loc_volume, seg_volume = load_ultrasound_case(case)
    slice_index = args.slice_index if args.slice_index is not None else loc_volume.shape[2] // 2
    if slice_index < 0 or slice_index >= loc_volume.shape[2]:
        raise ValueError(f"slice_index must be between 0 and {loc_volume.shape[2] - 1}")

    frame_path, seg_path = save_case_slice(loc_volume, seg_volume, case["case_id"], slice_index, args.output_dir)

    print(f"Loaded case: {case['case_id']} ({case['label']})")
    print(f"Volume shape: {loc_volume.shape}")
    print(f"Mask shape: {seg_volume.shape}")
    print(f"Saved frame to: {frame_path}")
    print(f"Saved segmentation mask to: {seg_path}")


if __name__ == "__main__":
    main()
