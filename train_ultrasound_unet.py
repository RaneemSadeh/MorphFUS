from __future__ import annotations

import argparse
import os
import random
from pathlib import Path
from typing import List, Tuple

import numpy as np
import torch
from torch import nn
from torch.optim import Adam
from torch.utils.data import DataLoader, Dataset

from data_loader import list_ultrasound_cases, load_ultrasound_case
from ultrasound_unet import TORCH_AVAILABLE, UNet, TorchSegmentationModel, save_unet_model


DEFAULT_DATA_DIR = os.path.join("Data", "02", "Radio-Freqency", "Pre-clinical _ultrasound_dataset", "all_cases")
DEFAULT_MODEL_PATH = os.path.join("models", "ultrasound_unet.pth")


def normalize_slice(slice_data: np.ndarray) -> np.ndarray:
    result = slice_data.astype(np.float32)
    if result.max() != result.min():
        result = (result - result.min()) / (result.max() - result.min())
    else:
        result = np.zeros_like(result, dtype=np.float32)
    return result


def pad_to_width(image: np.ndarray, target_width: int = 656) -> np.ndarray:
    if image.shape[1] >= target_width:
        return image[:, :target_width]
    pad_width = target_width - image.shape[1]
    return np.pad(image, ((0, 0), (0, pad_width)), mode="constant", constant_values=0)


class UltrasoundSliceDataset(Dataset):
    def __init__(self, cases: List[dict], target_width: int = 656) -> None:
        self.samples: List[Tuple[np.ndarray, np.ndarray]] = []
        for case in cases:
            volume, seg_volume = load_ultrasound_case(case)
            for slice_idx in range(volume.shape[2]):
                image = volume[:, :, slice_idx]
                mask = seg_volume[:, :, slice_idx]
                if image.size == 0 or mask.size == 0:
                    continue
                self.samples.append((image, mask))
        self.target_width = target_width

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        image, mask = self.samples[idx]
        image = normalize_slice(pad_to_width(image, self.target_width))
        mask = pad_to_width(mask.astype(np.uint8), self.target_width)
        image_tensor = torch.from_numpy(image).unsqueeze(0)
        mask_tensor = torch.from_numpy(mask.astype(np.float32)).unsqueeze(0)
        return image_tensor, mask_tensor


def dice_coefficient(pred: torch.Tensor, target: torch.Tensor, eps: float = 1e-7) -> torch.Tensor:
    pred = torch.sigmoid(pred)
    pred = (pred >= 0.5).float()
    intersection = (pred * target).sum(dim=(1, 2, 3))
    union = pred.sum(dim=(1, 2, 3)) + target.sum(dim=(1, 2, 3))
    return (2.0 * intersection + eps) / (union + eps)


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> float:
    model.eval()
    scores = []
    with torch.no_grad():
        for images, masks in loader:
            images = images.to(device)
            masks = masks.to(device)
            outputs = model(images)
            dices = dice_coefficient(outputs, masks)
            scores.extend(dices.cpu().numpy().tolist())
    return float(np.mean(scores)) if scores else 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a U-Net on the uploaded ultrasound dataset.")
    parser.add_argument("--data-dir", default=DEFAULT_DATA_DIR, help="Path to the ultrasound dataset all_cases directory")
    parser.add_argument("--test-size", type=float, default=0.2, help="Fraction of cases to hold out for evaluation")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed")
    parser.add_argument("--output-model", default=DEFAULT_MODEL_PATH, help="Path to save the trained U-Net model")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=8, help="Training batch size")
    parser.add_argument("--learning-rate", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--max-cases", type=int, default=None, help="Optional maximum number of cases to use for training and evaluation")
    args = parser.parse_args()

    if not TORCH_AVAILABLE:
        raise ImportError(
            "PyTorch is not available in this environment. "
            "Install a compatible torch package to run U-Net training."
        )

    torch.manual_seed(args.random_state)
    random.seed(args.random_state)
    np.random.seed(args.random_state)

    cases = list_ultrasound_cases(args.data_dir)
    if not cases:
        raise RuntimeError(f"No ultrasound cases found in {args.data_dir}")

    random.shuffle(cases)
    if args.max_cases is not None:
        cases = cases[: args.max_cases]

    case_ids = [case["case_id"] for case in cases]
    split_index = int(len(case_ids) * (1.0 - args.test_size))
    train_ids = case_ids[:split_index]
    test_ids = case_ids[split_index:]
    cases_by_id = {case["case_id"]: case for case in cases}
    train_cases = [cases_by_id[cid] for cid in train_ids]
    test_cases = [cases_by_id[cid] for cid in test_ids]

    if not train_cases:
        raise ValueError("The dataset split produced no training cases. Reduce --test-size or increase --max-cases.")
    if not test_cases:
        raise ValueError("The dataset split produced no test cases. Increase --test-size or increase --max-cases.")

    print("Train cases:", train_ids)
    print("Test cases:", test_ids)

    train_dataset = UltrasoundSliceDataset(train_cases)
    test_dataset = UltrasoundSliceDataset(test_cases)
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False, num_workers=0)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = UNet(in_channels=1, out_channels=1)
    model.to(device)

    optimizer = Adam(model.parameters(), lr=args.learning_rate)
    criterion = nn.BCEWithLogitsLoss()

    best_dice = 0.0
    for epoch in range(1, args.epochs + 1):
        model.train()
        epoch_losses = []
        for images, masks in train_loader:
            images = images.to(device)
            masks = masks.to(device)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()
            epoch_losses.append(loss.item())

        train_loss = float(np.mean(epoch_losses)) if epoch_losses else 0.0
        val_dice = evaluate(model, test_loader, device)
        print(f"Epoch {epoch}/{args.epochs} - loss={train_loss:.4f} val_dice={val_dice:.4f}")

        if val_dice > best_dice:
            best_dice = val_dice
            save_unet_model(model, args.output_model)
            print(f"Saved best U-Net model to {args.output_model} (dice={best_dice:.4f})")

    print(f"Training complete. Best validation dice: {best_dice:.4f}")
    print(f"Model saved to: {args.output_model}")

    best_model = TorchSegmentationModel(model=model, device=device)
    test_dice = evaluate(best_model.model, test_loader, device)
    print(f"Final test Dice score: {test_dice:.4f}")


if __name__ == "__main__":
    main()
