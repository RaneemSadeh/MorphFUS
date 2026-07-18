# Closed-Loop HIFU/SDT Prototype

A minimal, runnable version of the core idea: **the detector and the ablation
controller are not separate steps — they run in a loop, each cycle informing
the next.**

```
frame -> detect_tumor() -> measurement -> controller.compute_command()
      -> command (power, focal size) -> apply to tissue -> tumor changes
      -> next frame ...
```

## Files

- `tumor_sim.py` — stands in for a real patient/ultrasound feed. Generates
  synthetic B-mode-style frames with speckle noise and a tumor that shrinks
  according to applied power. **This is the piece you replace first.**
- `detection.py` — the perception step. Currently classical CV
  (threshold + contour + min enclosing circle). Returns a `TumorMeasurement`
  with position, radius, area, and a confidence score.
- `controller.py` — the decision step. Turns a measurement into a
  `ControlCommand` (power, focal spot radius, fire/no-fire), with:
  - power scaled to remaining tumor volume, hard-capped
  - focal spot tracking tumor size (shrinks together with it, so it stops
    irradiating healthy tissue that used to be tumor)
  - a taper zone near the stop threshold so the last bit is finished gently
  - a **confidence gate**: low-confidence detections drop power to minimum
    instead of trusting a noisy read — this is the safety-critical part
- `run_closed_loop.py` — runs the loop end to end, logs every cycle to
  `loop_log.csv`, saves an overlay frame every 10s to `frames/`, and produces
  `closed_loop_summary.png` (tumor radius / power / focal size vs. time).

## Run it

```bash
pip install -r requirements.txt
python3 run_closed_loop.py
```

## Using the uploaded real datasets

This repository now includes support for the uploaded real data in `Data/01` and `Data/02`.

- `Data/01/Flowmeter` contains the ultrasonic flowmeter diagnostics CSV files.
- `Data/02/Radio-Freqency/Pre-clinical _ultrasound_dataset/all_cases` contains the ultrasound Analyze 7.5 volumes and segmentation masks.

New helper scripts:

```bash
python3 train_flowmeter.py
python3 train_ultrasound_segmentation.py
python3 train_ultrasound_unet.py --max-cases 4 --epochs 1 --batch-size 2
python3 prepare_ultrasound_dataset.py --case-id Cage01_BL --slice-index 6
python3 run_ultrasound_replay.py --case-id Cage01_BL --slice-index 6 --model-path models/ultrasound_unet.pth
python3 run_closed_loop_on_dataset.py --case-id Cage01_BL --max-slices 8 --slice-step 2 --model-path models/ultrasound_unet.pth
```

`train_flowmeter.py` trains a simple classifier on the flowmeter dataset and saves a model to `models/`.
`train_ultrasound_segmentation.py` trains a baseline pixel-level segmentation model on the uploaded ultrasound dataset and saves it to `models/`.
`prepare_ultrasound_dataset.py` loads an ultrasound volume and segmentation mask, exports a representative slice, and prints the case metadata.
`run_ultrasound_replay.py` runs the detector on a real ultrasound slice and saves an overlay image for visual inspection. Pass `--model-path` to run the trained segmentation model instead of the default classical CV detector. If you use a `.pth` model, a working PyTorch install is required; if PyTorch is unavailable, use the `.pkl` segmentation model instead.
`run_closed_loop_on_dataset.py` replays a sequence of real ultrasound slices through the existing controller, logging control commands and saving summary plots.

The existing synthetic closed-loop demo remains unchanged, but these helpers demonstrate the first real-data integration path.

## How this maps onto your real project

| Prototype piece | Real-world replacement |
|---|---|
| `SyntheticTumorPatient.generate_frame()` | Live ultrasound transducer feed, or dataset frames for offline validation |
| `detection.py` thresholding | A segmentation model (U-Net / nnU-Net style) trained on your **Mendeley** and **BUSI (Kaggle)** datasets — both give you pixel-level tumor masks, which is exactly the supervised signal a segmentation model needs. The Nature Scientific Data paper is worth reading closely for their annotation protocol and validation methodology if you're building a training pipeline. |
| `apply_energy()`'s made-up shrink rate | A validated thermal dose model (e.g. cumulative equivalent minutes at 43°C — CEM43) or, for SDT, a ROS-dose/cell-kill model, driven by actual transducer physics |
| `AdaptiveController` | Same structure, but power/focal limits need to come from your transducer's actual specs and from safety margins set by a clinician/regulatory framework, not from a value I invented for the demo |
| 2D circle detection | For real 3D tracking you'll want either a 3D ultrasound probe or multi-plane 2D sweeps reconstructed into a volume — that's a distinct subsystem worth prototyping separately once this loop's control logic is validated |

## Important caveats to carry into the real project

- The physics here (shrink rate, coupling efficiency) is **illustrative, not
  medically valid** — it exists only so the control loop has something
  believable to react to while you build the software architecture.
- Per the research: HIFU is only clinically practical where the beam path
  avoids bone and air-filled cavities, and MRgFUS explicitly struggles with
  organ motion — your 3D tracking has to account for tissue motion
  (breathing, patient shifting), not just tumor size, or the control loop
  will be adjusting to the wrong target.
- The confidence gate in `controller.py` is a placeholder for something a
  real system needs to take much further: agreement across multiple frames,
  sensor fusion with a second imaging modality, and a hard fail-safe that
  stops firing entirely (not just reduces power) if tracking is lost, are
  standard requirements for any energy-delivery device that reacts to
  real-time imaging.
