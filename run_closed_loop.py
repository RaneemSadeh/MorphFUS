import os
import csv
import numpy as np
import cv2
import matplotlib.pyplot as plt

from tumor_sim import SyntheticTumorPatient
from detection import detect_tumor
from controller import AdaptiveController, ControlLimits


def draw_overlay(frame, measurement, command, t):
    vis = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
    if measurement.found:
        cx, cy = int(measurement.center_px[0]), int(measurement.center_px[1])
        cv2.circle(vis, (cx, cy), int(measurement.radius_px), (0, 220, 0), 1)
        focal_px = command.focal_radius_mm * patient.pixels_per_mm
        cv2.circle(vis, (cx, cy), int(max(focal_px, 1)), (0, 0, 255), 1)
    label = f"t={t:4.1f}s  r={measurement.radius_mm:5.2f}mm  P={command.power_watts:4.1f}W  conf={measurement.confidence:.2f}"
    cv2.putText(vis, label, (6, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1, cv2.LINE_AA)
    return vis


if __name__ == "__main__":
    os.makedirs("frames", exist_ok=True)

    initial_radius = 18.0
    patient = SyntheticTumorPatient(initial_radius_mm=initial_radius, seed=7)
    limits = ControlLimits(max_power_watts=40.0, min_power_watts=2.0, stop_radius_mm=1.5)
    controller = AdaptiveController(limits=limits, initial_radius_mm=initial_radius)

    max_time = 240.0
    t = 0.0

    rows = []
    frame_idx = 0

    while t < max_time:
        frame = patient.generate_frame()
        measurement = detect_tumor(frame, pixels_per_mm=patient.pixels_per_mm)
        command = controller.compute_command(measurement, dt_seconds=dt)

        if command.fire:
            coupling = patient.apply_energy(command.power_watts, command.focal_radius_mm, dt)
        else:
            coupling = 0.0

        rows.append({
            "t_s": round(t, 2),
            "true_radius_mm": round(patient.radius_mm, 3),
            "measured_radius_mm": round(measurement.radius_mm, 3) if measurement.found else None,
            "confidence": round(measurement.confidence, 3),
            "power_w": round(command.power_watts, 3),
            "focal_radius_mm": round(command.focal_radius_mm, 3),
            "coupling_efficiency": round(coupling, 3),
            "reason": command.reason,
        })

        if frame_idx % 20 == 0:  # save every 10s of sim time for inspection
            vis = draw_overlay(frame, measurement, command, t)
            cv2.imwrite(f"frames/frame_{frame_idx:04d}.png", vis)

        if not command.fire and command.reason.startswith("tumor not detected"):
            break

        t += dt
        frame_idx += 1

    # --- write log ---
    with open("loop_log.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    ts = [r["t_s"] for r in rows]
    true_r = [r["true_radius_mm"] for r in rows]
    meas_r = [r["measured_radius_mm"] for r in rows]
    power = [r["power_w"] for r in rows]
    focal = [r["focal_radius_mm"] for r in rows]

    fig, axes = plt.subplots(3, 1, figsize=(8, 9), sharex=True)

    axes[0].plot(ts, true_r, label="true tumor radius", color="#1b7a3d")
    axes[0].plot(ts, meas_r, label="detected radius", color="#1b7a3d", linestyle="--", alpha=0.6)
    axes[0].axhline(limits.stop_radius_mm, color="gray", linestyle=":", label="stop threshold")
    axes[0].set_ylabel("radius (mm)")
    axes[0].legend(loc="upper right", fontsize=8)
    axes[0].set_title("Closed-loop HIFU/SDT prototype: detection -> control -> ablation")

    axes[1].plot(ts, power, color="#b3401f")
    axes[1].set_ylabel("applied power (W)")

    axes[2].plot(ts, focal, color="#2255aa")
    axes[2].set_ylabel("focal spot radius (mm)")
    axes[2].set_xlabel("time (s)")

    for ax in axes:
        ax.grid(alpha=0.25)

    plt.tight_layout()
    plt.savefig("closed_loop_summary.png", dpi=150)

    print(f"Finished after {t:.1f}s simulated. Final true radius: {patient.radius_mm:.2f}mm")
    print("Wrote loop_log.csv, closed_loop_summary.png, and frames/")
