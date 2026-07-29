from __future__ import annotations

import argparse
import math
from pathlib import Path

from outreach_common import BG, BLUE, BLUE_DARK, FPS, LINE, MUTED, ORANGE, PAPER, PIXEL_H, PIXEL_W, TEXT, font, hex_rgb, save_video

RUN_TIME = 10.4


def smoothstep(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def pulse(alpha: float, start: float, end: float) -> float:
    if alpha < start or alpha > end:
        return 0.0
    x = (alpha - start) / (end - start)
    return smoothstep(x) if x < 0.5 else smoothstep(1 - x)


def pressure_profile(alpha: float) -> float:
    rise = smoothstep((alpha - 0.10) / 0.20)
    release = smoothstep((alpha - 0.64) / 0.20)
    return rise * (1 - release)


def pressure_arrow_visibility(alpha: float) -> float:
    fade_in = smoothstep((alpha - 0.06) / 0.08)
    fade_out = smoothstep((alpha - 0.88) / 0.08)
    return fade_in * (1 - fade_out)


def simulate_diver(frame_count: int) -> list[tuple[float, float, float, float]]:
    top_y = 225.0
    y = top_y
    velocity = 0.0
    states = []
    threshold = 0.38
    dt = RUN_TIME / max(1, frame_count - 1)

    for frame_index in range(frame_count):
        alpha = frame_index / (frame_count - 1)
        pressure = pressure_profile(alpha)
        acceleration = 650 * (pressure - threshold) - 2.1 * velocity
        if pressure < threshold and y > top_y:
            acceleration -= 1.75 * (y - top_y) * (1.08 - pressure)

        velocity += acceleration * dt
        y += velocity * dt

        if y < top_y:
            y = top_y
            if velocity < 0:
                velocity = 0.0
        if y > 456:
            y = 456
            if velocity > 0:
                velocity = 0.0

        states.append((alpha, pressure, y, velocity))

    return states


def render_fallback(
    video_path: Path = Path("img/outreach/cartesian-diver.mp4"),
    poster_path: Path = Path("img/outreach/cartesian-diver-poster.png"),
) -> None:
    from PIL import Image, ImageDraw

    label_font = font(24)
    frames = []
    bottle_cx = PIXEL_W // 2
    bottle_top = 95
    bottle_bottom = 575
    bottle_w = 300
    water_top = 155
    states = simulate_diver(int(RUN_TIME * FPS))
    threshold = 0.38

    def side_points(squeeze: float, y0: float = bottle_top, y1: float = bottle_bottom, steps: int = 28):
        amount = 32 * squeeze
        left_points = []
        right_points = []
        for index in range(steps + 1):
            y = y0 + (y1 - y0) * index / steps
            phase = (y - bottle_top) / (bottle_bottom - bottle_top)
            inset = amount * max(0.0, math.sin(math.pi * phase))
            left_points.append((bottle_cx - bottle_w / 2 + inset, y))
            right_points.append((bottle_cx + bottle_w / 2 - inset, y))
        return left_points, right_points

    def draw_arrow(draw, start, end, color, width=6, opacity=255):
        x0, y0 = start
        x1, y1 = end
        rgba = color + (opacity,) if len(color) == 3 else color
        dx = x1 - x0
        dy = y1 - y0
        length = max(1.0, math.hypot(dx, dy))
        ux = dx / length
        uy = dy / length
        px = -uy
        py = ux
        head_len = max(16.0, width * 3.0)
        head_w = max(17.0, width * 3.0)
        shaft_end_x = x1 - ux * head_len
        shaft_end_y = y1 - uy * head_len
        half = width / 2
        shaft = [
            (x0 + px * half, y0 + py * half),
            (shaft_end_x + px * half, shaft_end_y + py * half),
            (shaft_end_x - px * half, shaft_end_y - py * half),
            (x0 - px * half, y0 - py * half),
        ]
        head = [
            (x1, y1),
            (shaft_end_x + px * head_w / 2, shaft_end_y + py * head_w / 2),
            (shaft_end_x - px * head_w / 2, shaft_end_y - py * head_w / 2),
        ]
        draw.polygon(shaft, fill=rgba)
        draw.polygon(head, fill=rgba)

    for frame_index, (alpha, pressure, diver_y, velocity) in enumerate(states):
        squeeze = pressure

        image = Image.new("RGB", (PIXEL_W, PIXEL_H), hex_rgb(BG))
        draw = ImageDraw.Draw(image, "RGBA")

        left_side, right_side = side_points(squeeze)
        water_left, water_right = side_points(squeeze, water_top, bottle_bottom - 20, steps=20)
        bottle_shape = left_side + list(reversed(right_side))
        water_shape = water_left + list(reversed(water_right))
        draw.polygon(bottle_shape, fill=(255, 250, 242, 62))
        draw.polygon(water_shape, fill=hex_rgb(BLUE) + (72,))
        draw.line(left_side, fill=hex_rgb(BLUE_DARK) + (175,), width=4, joint="curve")
        draw.line(right_side, fill=hex_rgb(BLUE_DARK) + (175,), width=4, joint="curve")
        draw.line((left_side[0], right_side[0]), fill=hex_rgb(BLUE_DARK) + (140,), width=4)
        draw.line((left_side[-1], right_side[-1]), fill=hex_rgb(BLUE_DARK) + (140,), width=4)
        water_left_edge = water_left[0][0]
        water_right_edge = water_right[0][0]
        draw.line((water_left_edge, water_top, water_right_edge, water_top), fill=hex_rgb(BLUE_DARK) + (120,), width=2)

        arrow_alpha = pressure_arrow_visibility(alpha)
        if arrow_alpha > 0.01:
            pressure_color = hex_rgb("#9b4f21")
            opacity = int(230 * arrow_alpha)
            for side in (-1, 1):
                y = 315
                x0 = bottle_cx + side * (390 - 70 * pressure)
                x1 = bottle_cx + side * (205 - 60 * pressure)
                draw_arrow(draw, (x0, y), (x1, y), pressure_color, width=7, opacity=opacity)

        diver_x = bottle_cx
        diver_w = 74
        diver_h = 138
        air_h = 55 - 30 * pressure
        water_h = diver_h - air_h - 18

        draw.rounded_rectangle((diver_x - diver_w / 2, diver_y - diver_h / 2, diver_x + diver_w / 2, diver_y + diver_h / 2), radius=18, fill=(255, 250, 242, 165), outline=hex_rgb(TEXT) + (180,), width=3)
        draw.rounded_rectangle((diver_x - diver_w / 2 + 8, diver_y - diver_h / 2 + 9, diver_x + diver_w / 2 - 8, diver_y - diver_h / 2 + 9 + air_h), radius=12, fill=(255, 255, 255, 230))
        draw.rectangle((diver_x - diver_w / 2 + 8, diver_y + diver_h / 2 - water_h - 9, diver_x + diver_w / 2 - 8, diver_y + diver_h / 2 - 9), fill=hex_rgb(BLUE) + (135,))

        weight_len = 56
        if diver_y <= 226 and pressure < threshold:
            buoy_len = weight_len
        else:
            buoy_len = max(26, weight_len - 42 * max(0, pressure - threshold))
        draw_arrow(draw, (diver_x, diver_y), (diver_x, diver_y + weight_len), hex_rgb(TEXT), width=6)
        draw_arrow(draw, (diver_x, diver_y), (diver_x, diver_y - buoy_len), hex_rgb(BLUE_DARK), width=6)

        draw_arrow(draw, (82, 624), (82, 592), hex_rgb(BLUE_DARK), width=5)
        draw.text((106, 580), "buoyant force", fill=hex_rgb(MUTED), font=label_font)
        draw_arrow(draw, (318, 592), (318, 624), hex_rgb(TEXT), width=5)
        draw.text((342, 580), "gravity", fill=hex_rgb(MUTED), font=label_font)
        frames.append(image.convert("RGB"))

    save_video(frames, video_path, poster_path, poster_index=112)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render the Cartesian diver animation.")
    parser.add_argument("--fallback-render", action="store_true")
    parser.add_argument("--video", type=Path, default=Path("img/outreach/cartesian-diver.mp4"))
    parser.add_argument("--poster", type=Path, default=Path("img/outreach/cartesian-diver-poster.png"))
    args = parser.parse_args()
    render_fallback(args.video, args.poster)


if __name__ == "__main__":
    main()
