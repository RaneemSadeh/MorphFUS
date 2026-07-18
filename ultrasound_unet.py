from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
    TORCH_IMPORT_ERROR = None
except Exception as exc:
    torch = None
    nn = None
    F = None
    TORCH_AVAILABLE = False
    TORCH_IMPORT_ERROR = exc


if TORCH_AVAILABLE:
    class DoubleConv(nn.Module):
        def __init__(self, in_channels: int, out_channels: int) -> None:
            super().__init__()
            self.double_conv = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
                nn.BatchNorm2d(out_channels),
                nn.ReLU(inplace=True),
                nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
                nn.BatchNorm2d(out_channels),
                nn.ReLU(inplace=True),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            return self.double_conv(x)


    class Down(nn.Module):
        def __init__(self, in_channels: int, out_channels: int) -> None:
            super().__init__()
            self.maxpool_conv = nn.Sequential(
                nn.MaxPool2d(2),
                DoubleConv(in_channels, out_channels),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            return self.maxpool_conv(x)


    class Up(nn.Module):
        def __init__(self, in_channels: int, out_channels: int) -> None:
            super().__init__()
            self.up = nn.ConvTranspose2d(in_channels, in_channels // 2, kernel_size=2, stride=2)
            self.conv = DoubleConv(in_channels, out_channels)

        def forward(self, x1: torch.Tensor, x2: torch.Tensor) -> torch.Tensor:
            x1 = self.up(x1)
            diffY = x2.size()[2] - x1.size()[2]
            diffX = x2.size()[3] - x1.size()[3]
            x1 = F.pad(x1, [diffX // 2, diffX - diffX // 2, diffY // 2, diffY - diffY // 2])
            x = torch.cat([x2, x1], dim=1)
            return self.conv(x)


    class OutConv(nn.Module):
        def __init__(self, in_channels: int, out_channels: int) -> None:
            super().__init__()
            self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=1)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            return self.conv(x)


    class UNet(nn.Module):
        def __init__(self, in_channels: int = 1, out_channels: int = 1, features: tuple[int, ...] = (64, 128, 256, 512)) -> None:
            super().__init__()
            self.inc = DoubleConv(in_channels, features[0])
            self.down1 = Down(features[0], features[1])
            self.down2 = Down(features[1], features[2])
            self.down3 = Down(features[2], features[3])
            self.up1 = Up(features[3], features[2])
            self.up2 = Up(features[2], features[1])
            self.up3 = Up(features[1], features[0])
            self.outc = OutConv(features[0], out_channels)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            x1 = self.inc(x)
            x2 = self.down1(x1)
            x3 = self.down2(x2)
            x4 = self.down3(x3)
            x = self.up1(x4, x3)
            x = self.up2(x, x2)
            x = self.up3(x, x1)
            return self.outc(x)


    @dataclass
    class TorchSegmentationModel:
        model: nn.Module
        device: torch.device

        def predict_mask(self, frame: np.ndarray, threshold: float = 0.5) -> np.ndarray:
            image = frame.astype(np.float32)
            if image.max() != image.min():
                image = (image - image.min()) / (image.max() - image.min())
            else:
                image = np.zeros_like(image, dtype=np.float32)

            tensor = torch.from_numpy(image).unsqueeze(0).unsqueeze(0).to(self.device)
            self.model.eval()
            with torch.no_grad():
                logits = self.model(tensor)
                probs = torch.sigmoid(logits)
                mask = (probs >= threshold).to(torch.uint8)
            return mask.squeeze(0).squeeze(0).cpu().numpy()


    def save_unet_model(model: nn.Module, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        torch.save({"state_dict": model.state_dict()}, path)


    def load_unet_model(path: str, device: Optional[torch.device] = None) -> TorchSegmentationModel:
        if device is None:
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        checkpoint = torch.load(path, map_location=device)
        model = UNet()
        model.load_state_dict(checkpoint["state_dict"])
        model.to(device)
        model.eval()
        return TorchSegmentationModel(model=model, device=device)
else:
    UNet = None

    @dataclass
    class TorchSegmentationModel:
        model: Optional[object]
        device: Optional[object]

        def __post_init__(self):
            raise ImportError(
                "PyTorch is not available in this Python environment. "
                "Install a compatible torch package to load or use .pth segmentation models."
            )

    def save_unet_model(model: object, path: str) -> None:
        raise ImportError(
            "PyTorch is not available in this Python environment. "
            "Install a compatible torch package to save .pth segmentation models."
        )

    def load_unet_model(path: str, device: Optional[object] = None) -> TorchSegmentationModel:
        raise ImportError(
            "PyTorch is not available in this Python environment. "
            "Install a compatible torch package to load .pth segmentation models."
        )
