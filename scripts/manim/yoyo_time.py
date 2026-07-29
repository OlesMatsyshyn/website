from __future__ import annotations

import argparse
import math
from pathlib import Path

from outreach_common import BG, BLUE, BLUE_DARK, FPS, LINE, MUTED, ORANGE, PAPER, PIXEL_H, PIXEL_W, TEXT, font, hex_rgb, save_video_stream

CYCLE_COUNT = 20
CYCLE_TIME = 2.6
RUN_TIME = CYCLE_COUNT * CYCLE_TIME
HIGH_Y = 190
LOW_Y = 475
AXLE_R = 28


def wheel_state(global_alpha: float) -> tuple[float, float, float, int]:
    center_x = PIXEL_W // 2
    phase = 2 * math.pi * CYCLE_COUNT * global_alpha
    displacement = (LOW_Y - HIGH_Y) * (1 - math.cos(phase)) / 2
    y = HIGH_Y + displacement
    turns = displacement / (2 * math.pi * AXLE_R)
    periods = min(CYCLE_COUNT, int(math.floor(CYCLE_COUNT * global_alpha + 1e-6)))
    return center_x, y, turns, periods


def render_fallback(
    video_path: Path = Path("img/outreach/yoyo-time.mp4"),
    poster_path: Path = Path("img/outreach/yoyo-time-poster.png"),
) -> None:
    from PIL import Image, ImageDraw

    label_font = font(27)
    note_font = font(24)
    anchor_x = PIXEL_W // 2
    top_y = 95
    support_y = 88
    support_half_w = 185
    body_r = 58
    axle_r = AXLE_R
    hole_r = 11

    frame_count = int(RUN_TIME * FPS)

    def draw_frame(frame_index: int) -> Image.Image:
        alpha = frame_index / (int(RUN_TIME * FPS) - 1)
        x, y, turns, periods = wheel_state(alpha)

        image = Image.new("RGB", (PIXEL_W, PIXEL_H), hex_rgb(BG))
        draw = ImageDraw.Draw(image)

        left_anchor = anchor_x - axle_r
        right_anchor = anchor_x + axle_r
        draw.line((anchor_x - support_half_w, support_y, anchor_x + support_half_w, support_y), fill=hex_rgb(TEXT), width=8)
        draw.line((left_anchor, top_y, x - axle_r, y), fill=hex_rgb(TEXT), width=3)
        draw.line((right_anchor, top_y, x + axle_r, y), fill=hex_rgb(TEXT), width=3)

        draw.ellipse((x - body_r, y - body_r, x + body_r, y + body_r), fill=hex_rgb(BLUE), outline=hex_rgb(BLUE_DARK), width=3)
        draw.ellipse((x - body_r * 0.66, y - body_r * 0.66, x + body_r * 0.66, y + body_r * 0.66), outline=hex_rgb(BLUE_DARK), width=2)
        draw.ellipse((x - axle_r, y - axle_r, x + axle_r, y + axle_r), fill=hex_rgb("#3f95c7"), outline=hex_rgb(BLUE_DARK), width=2)

        angle = turns * 2 * math.pi
        for offset in (0, math.pi / 2):
            a = angle + offset
            x0 = x + math.cos(a) * hole_r
            y0 = y + math.sin(a) * hole_r
            x1 = x - math.cos(a) * body_r * 0.72
            y1 = y - math.sin(a) * body_r * 0.72
            draw.line((x0, y0, x1, y1), fill=hex_rgb(PAPER), width=3)

        arc_box = (x - axle_r - 6, y - axle_r - 6, x + axle_r + 6, y + axle_r + 6)
        draw.arc(arc_box, start=210, end=330, fill=hex_rgb(TEXT), width=3)
        draw.arc(arc_box, start=30, end=150, fill=hex_rgb(TEXT), width=3)
        draw.ellipse((x - hole_r, y - hole_r, x + hole_r, y + hole_r), fill=hex_rgb(PAPER), outline=hex_rgb(BLUE_DARK), width=2)
        draw.text((84, 586), "Time measured by counting cycles", fill=hex_rgb(MUTED), font=note_font)
        draw.text((84, 624), f"Periods: {periods}", fill=hex_rgb(TEXT), font=label_font)
        return image

    save_video_stream(draw_frame, frame_count, video_path, poster_path, poster_index=int(0.28 * CYCLE_TIME * FPS))


def main() -> None:
    parser = argparse.ArgumentParser(description="Render the Maxwell pendulum time animation.")
    parser.add_argument("--fallback-render", action="store_true")
    parser.add_argument("--video", type=Path, default=Path("img/outreach/yoyo-time.mp4"))
    parser.add_argument("--poster", type=Path, default=Path("img/outreach/yoyo-time-poster.png"))
    args = parser.parse_args()
    render_fallback(args.video, args.poster)


if __name__ == "__main__":
    main()
