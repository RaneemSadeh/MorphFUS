"""
data_loader.py
--------------
Utilities for loading the uploaded real datasets so the prototype can be
trained and evaluated on real flowmeter diagnostics and real ultrasound
volume data.
"""

from __future__ import annotations

import csv
import os
import re
import struct
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import numpy as np
import pandas as pd


ANALYZE_DATATYPE_TO_DTYPE = {
    2: np.uint8,
    4: np.int16,
    8: np.int32,
    16: np.float32,
    64: np.float64,
    512: np.uint16,
}


def load_flowmeter_dataset(data_dir: str = "Data/01/Flowmeter") -> pd.DataFrame:
    """Load the flowmeter diagnostics CSV files into a single DataFrame."""
    data_path = Path(data_dir)
    if not data_path.exists():
        raise FileNotFoundError(f"Flowmeter dataset directory not found: {data_path}")

    csv_files = sorted(data_path.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {data_path}")

    frames = []
    for csv_file in csv_files:
        df = pd.read_csv(csv_file)
        if "fault_class" not in df.columns:
            raise ValueError(f"Expected 'fault_class' column in {csv_file}")
        frames.append(df)

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.loc[:, ~combined.columns.str.contains(r'^Unnamed')]
    return combined


def prepare_flowmeter_features(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """Convert the flowmeter DataFrame into feature and label arrays."""
    if "fault_class" not in df.columns:
        raise ValueError("DataFrame must contain a 'fault_class' column")

    features = df.drop(columns=["fault_class"]).select_dtypes(include=[np.number])
    labels = df["fault_class"].astype(int).to_numpy()
    return features.to_numpy(dtype=np.float32), labels, list(features.columns)


def parse_analyze_header(hdr_path: str) -> Dict[str, Any]:
    """Parse an Analyze 7.5 header (.hdr) and return relevant metadata."""
    hdr_path = Path(hdr_path)
    if not hdr_path.exists():
        raise FileNotFoundError(f"Header file not found: {hdr_path}")

    with open(hdr_path, "rb") as f:
        hdr = f.read(348)

    if len(hdr) < 348:
        raise ValueError(f"Analyze header file is truncated: {hdr_path}")

    # dim[0..7] is at byte 40, datatype at 70, bitpix at 72, and vox_offset at 108.
    dims = struct.unpack("<hhhhhhhhhhh", hdr[40:62])
    datatype = struct.unpack("<h", hdr[70:72])[0]
    bitpix = struct.unpack("<h", hdr[72:74])[0]
    vox_offset = struct.unpack("<f", hdr[108:112])[0]

    if dims[0] <= 0:
        raise ValueError(f"Invalid Analyze header dimensions in {hdr_path}")

    shape = tuple(dims[1 : dims[0] + 1])
    # Drop trailing singleton dimensions; Analyze can encode shape as e.g. (289, 648, 13, 1).
    shape = tuple(dim for dim in shape if dim > 1)
    dtype = ANALYZE_DATATYPE_TO_DTYPE.get(datatype)
    if dtype is None:
        raise ValueError(f"Unsupported Analyze datatype {datatype} in {hdr_path}")

    return {
        "shape": shape,
        "datatype": datatype,
        "bitpix": bitpix,
        "vox_offset": vox_offset,
        "dtype": dtype,
        "hdr_path": str(hdr_path),
        "img_path": str(hdr_path.with_suffix(".img")),
    }


def load_analyze_volume(hdr_path: str) -> np.ndarray:
    """Load an Analyze 7.5 volume from a .hdr/.img pair."""
    meta = parse_analyze_header(hdr_path)
    img_path = Path(meta["img_path"])
    if not img_path.exists():
        raise FileNotFoundError(f"Image file not found: {img_path}")

    expected_count = int(np.prod(meta["shape"]))
    dtype = meta["dtype"]
    volume = np.fromfile(img_path, dtype=dtype, count=expected_count)
    if volume.size != expected_count:
        raise ValueError(
            f"Image file size does not match dimensions for {img_path}: "
            f"expected {expected_count} values, got {volume.size}"
        )

    return volume.reshape(meta["shape"], order="F")


def list_ultrasound_cases(
    base_dir: str = "Data/02/Radio-Freqency/Pre-clinical _ultrasound_dataset/all_cases",
) -> List[Dict[str, Any]]:
    """List available ultrasound cases and their segmentation pairs."""
    base = Path(base_dir)
    if not base.exists():
        raise FileNotFoundError(f"Ultrasound dataset directory not found: {base}")

    cases: Dict[str, Dict[str, Any]] = {}
    for label_dir in sorted(base.iterdir()):
        if not label_dir.is_dir():
            continue
        name_lower = label_dir.name.lower()
        if "non-progressive" in name_lower:
            label = "non-progressive"
        elif "progressive" in name_lower:
            label = "progressive"
        else:
            label = "unknown"
        for hdr_path in sorted(label_dir.glob("*.hdr")):
            stem = hdr_path.stem
            if stem.lower().endswith("_loc"):
                case_id = stem[: -len("_loc")]
                cases.setdefault(case_id, {
                    "case_id": case_id,
                    "label": label,
                    "loc_hdr": None,
                    "seg_hdr": None,
                    "directory": str(label_dir),
                })["loc_hdr"] = str(hdr_path)
            elif stem.lower().endswith("_seg"):
                case_id = stem[: -len("_seg")]
                cases.setdefault(case_id, {
                    "case_id": case_id,
                    "label": label,
                    "loc_hdr": None,
                    "seg_hdr": None,
                    "directory": str(label_dir),
                })["seg_hdr"] = str(hdr_path)

    return [case for case in cases.values() if case["loc_hdr"] and case["seg_hdr"]]


def load_ultrasound_case(case_info: Dict[str, Any]) -> Tuple[np.ndarray, np.ndarray]:
    """Load a single ultrasound case's location volume and segmentation volume."""
    if "loc_hdr" not in case_info or "seg_hdr" not in case_info:
        raise ValueError("case_info must include 'loc_hdr' and 'seg_hdr'")

    loc_volume = load_analyze_volume(case_info["loc_hdr"])
    seg_volume = load_analyze_volume(case_info["seg_hdr"])
    return loc_volume, seg_volume


def summarize_ultrasound_dataset(base_dir: str = None) -> pd.DataFrame:
    """Return a summary DataFrame of the ultrasound dataset cases."""
    cases = list_ultrasound_cases(base_dir or "Data/02/Radio-Freqency/Pre-clinical _ultrasound_dataset/all_cases")
    rows = []
    for case in cases:
        rows.append({
            "case_id": case["case_id"],
            "label": case["label"],
            "loc_hdr": case["loc_hdr"],
            "seg_hdr": case["seg_hdr"],
        })
    return pd.DataFrame(rows)
