from __future__ import annotations

import argparse
import math
from pathlib import Path

from outreach_common import BG, BLUE, BLUE_DARK, FPS, GREEN, LINE, MUTED, ORANGE, PAPER, PIXEL_H, PIXEL_W, TEXT, font, hex_rgb, save_video_stream

RUN_TIME = 16.0 / 0.3
BOUNCE_COUNT = 10
CYCLE_TIME = RUN_TIME / BOUNCE_COUNT

BALL_X = 365
GROUND_Y = 548
BALL_R = 44
TOP_HEIGHT = 330
CONTACT_START = 0.43
CONTACT_END = 0.57
FLOOR_HALF_WIDTH = 135


def cycle_state(alpha: float) -> tuple[float, float, float, float, float, float]:
    """Return center y, horizontal scale, vertical scale, and energy fractions."""
    cycle_progress = min(alpha * BOUNCE_COUNT, BOUNCE_COUNT - 1e-7)
    local = cycle_progress - math.floor(cycle_progress)

    if local < CONTACT_START:
        u = local / CONTACT_START
        height = TOP_HEIGHT * (1 - u * u)
        gravitational = max(0.0, height / TOP_HEIGHT)
        kinetic = 1 - gravitational
        return GROUND_Y - BALL_R - height, 1.0, 1.0, gravitational, 0.0, kinetic

    if local <= CONTACT_END:
        theta = math.pi * (local - CONTACT_START) / (CONTACT_END - CONTACT_START)
        amount = math.sin(theta)
        vertical = 1 - 0.35 * amount
        horizontal = 1 + 0.18 * amount
        kinetic = math.cos(theta) ** 2
        elastic = math.sin(theta) ** 2
        return GROUND_Y - BALL_R * vertical, horizontal, vertical, 0.0, elastic, kinetic

    u = (local - CONTACT_END) / (1 - CONTACT_END)
    height = TOP_HEIGHT * (2 * u - u * u)
    gravitational = max(0.0, min(1.0, height / TOP_HEIGHT))
    kinetic = 1 - gravitational
    return GROUND_Y - BALL_R - height, 1.0, 1.0, gravitational, 0.0, kinetic


def draw_energy_bar(draw, label: str, fraction: float, color: str, y: int, label_font) -> None:
    label_x = 590
    bar_x = 750
    bar_w = 340
    bar_h = 28

    draw.text((label_x, y - 3), label, fill=hex_rgb(TEXT), font=label_font)
    draw.rounded_rectangle(
        (bar_x, y, bar_x + bar_w, y + bar_h),
        radius=8,
        fill=hex_rgb(PAPER),
        outline=hex_rgb(LINE),
        width=2,
    )
    fill_w = max(0, min(bar_w, int(bar_w * fraction)))
    if fill_w > 0:
        draw.rounded_rectangle(
            (bar_x, y, bar_x + fill_w, y + bar_h),
            radius=8,
            fill=hex_rgb(color),
            outline=None,
        )


def draw_centered_text(draw, text: str, y: int, text_font, color: str = MUTED) -> None:
    bbox = draw.textbbox((0, 0), text, font=text_font)
    text_w = bbox[2] - bbox[0]
    draw.text(((PIXEL_W - text_w) / 2, y), text, fill=hex_rgb(color), font=text_font)


def render_fallback(
    video_path: Path = Path("img/outreach/elastic-collision.mp4"),
    poster_path: Path = Path("img/outreach/elastic-collision-poster.png"),
) -> None:
    """Render a deterministic bouncing-ball energy animation."""
    from PIL import Image, ImageDraw

    video_path.parent.mkdir(parents=True, exist_ok=True)
    poster_path.parent.mkdir(parents=True, exist_ok=True)

    title_font = font(26)
    label_font = font(24)
    frame_count = int(RUN_TIME * FPS)

    def draw_frame(frame_index: int) -> Image.Image:
        alpha = frame_index / (frame_count - 1)
        y, horizontal, vertical, gravitational, elastic, kinetic = cycle_state(alpha)

        image = Image.new("RGB", (PIXEL_W, PIXEL_H), hex_rgb(BG))
        draw = ImageDraw.Draw(image)

        draw_centered_text(draw, "Bouncing ball: energy changes during free fall and elastic impact", 54, title_font)
        draw.line((BALL_X - FLOOR_HALF_WIDTH, GROUND_Y, BALL_X + FLOOR_HALF_WIDTH, GROUND_Y), fill=hex_rgb(TEXT), width=5)

        ball_w = BALL_R * horizontal
        ball_h = BALL_R * vertical
        draw.ellipse(
            (BALL_X - ball_w, y - ball_h, BALL_X + ball_w, y + ball_h),
            fill=hex_rgb(BLUE),
            outline=hex_rgb(BLUE_DARK),
            width=3,
        )

        draw_energy_bar(draw, "Gravitational", gravitational, GREEN, 330, label_font)
        draw_energy_bar(draw, "Kinetic", kinetic, BLUE, 385, label_font)
        draw_energy_bar(draw, "Elastic", elastic, ORANGE, 440, label_font)
        return image

    poster_index = int((CONTACT_START + 0.5 * (CONTACT_END - CONTACT_START)) * CYCLE_TIME * FPS)
    save_video_stream(draw_frame, frame_count, video_path, poster_path, poster_index=poster_index)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render the bouncing-ball energy outreach animation.")
    parser.add_argument("--fallback-render", action="store_true", help="Render MP4 and poster without invoking Manim.")
    parser.add_argument("--video", type=Path, default=Path("img/outreach/elastic-collision.mp4"))
    parser.add_argument("--poster", type=Path, default=Path("img/outreach/elastic-collision-poster.png"))
    args = parser.parse_args()

    if not args.fallback_render:
        raise SystemExit("Run this deterministic renderer with --fallback-render.")

    render_fallback(args.video, args.poster)


if __name__ == "__main__":
    main()
