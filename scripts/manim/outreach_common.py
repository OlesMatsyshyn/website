from __future__ import annotations

from pathlib import Path

BG = "#f7f2ea"
PAPER = "#fffaf2"
TEXT = "#26231f"
MUTED = "#706a62"
LINE = "#d9cfc1"
BLUE = "#2c7fb8"
BLUE_DARK = "#1f526f"
ORANGE = "#d08132"
GREEN = "#5f8f75"

FRAME_W = 12.8
FRAME_H = 7.2
PIXEL_W = 1280
PIXEL_H = 720
FPS = 30


def hex_rgb(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    return tuple(int(color[i : i + 2], 16) for i in (0, 2, 4))


def to_px(x: float, y: float) -> tuple[int, int]:
    px = int((x + FRAME_W / 2) / FRAME_W * PIXEL_W)
    py = int((FRAME_H / 2 - y) / FRAME_H * PIXEL_H)
    return px, py


def font(size: int):
    from PIL import ImageFont

    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def save_video(frames, video_path: Path, poster_path: Path, poster_index: int = 12) -> None:
    import imageio.v2 as imageio

    video_path.parent.mkdir(parents=True, exist_ok=True)
    poster_path.parent.mkdir(parents=True, exist_ok=True)
    frames[max(0, min(poster_index, len(frames) - 1))].save(poster_path)
    imageio.mimsave(
        video_path,
        frames,
        fps=FPS,
        quality=8,
        macro_block_size=1,
        output_params=["-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"],
    )


def save_video_stream(frame_factory, frame_count: int, video_path: Path, poster_path: Path, poster_index: int = 12) -> None:
    import imageio.v2 as imageio
    import numpy as np

    video_path.parent.mkdir(parents=True, exist_ok=True)
    poster_path.parent.mkdir(parents=True, exist_ok=True)
    poster_frame = max(0, min(poster_index, frame_count - 1))
    with imageio.get_writer(
        video_path,
        fps=FPS,
        quality=8,
        macro_block_size=1,
        output_params=["-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an"],
    ) as writer:
        for frame_index in range(frame_count):
            frame = frame_factory(frame_index)
            if frame_index == poster_frame:
                frame.save(poster_path)
            writer.append_data(np.asarray(frame))
