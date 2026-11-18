#!/usr/bin/env python3
"""Create correctly sized PWA PNG icons from the approved high-resolution master."""
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "file_00000000670481f4ad879246afe6bae2.png"
TARGETS = {192: ROOT / "icon-192.png", 512: ROOT / "icon-512.png"}


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Approved master icon is missing: {SOURCE.name}")

    with Image.open(SOURCE) as source:
        if source.format != "PNG":
            raise SystemExit("The approved master icon must be a PNG.")
        if source.width != source.height or source.width < 512:
            raise SystemExit(
                f"Expected a square PNG of at least 512px, got {source.width}x{source.height}."
            )
        master = source.convert("RGBA")

    for size, destination in TARGETS.items():
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        if size == 192:
            # Counteract slight softness from downsampling while preserving the approved artwork.
            resized = resized.filter(
                ImageFilter.UnsharpMask(radius=0.7, percent=125, threshold=2)
            )
        resized.save(destination, format="PNG", optimize=True)
        with Image.open(destination) as check:
            if check.size != (size, size) or check.format != "PNG":
                raise SystemExit(f"Generated icon failed verification: {destination.name}")
        print(f"Generated {destination.name}: {size}x{size} from {SOURCE.name}")


if __name__ == "__main__":
    main()
