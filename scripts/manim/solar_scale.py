from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

from outreach_common import FPS, MUTED, PAPER, PIXEL_H, PIXEL_W, font, hex_rgb, save_video_stream

RUN_TIME = 60.0
PIXELS_PER_METER = 120.0
LOW_SPEED_MPS = 2.0
EARTH_RADIUS_PX = 18.0
PLANET_DISPLAY_SCALE = 1.3
STAR_SHIFT_PER_METER = 80.0
ENCOUNTER_HALF_TIME = 1.0
EARTH_SLOW_END = 4.0

EARTH_X = 0.0
MARS_X = 61.0
JUPITER_X = 494.0
SATURN_X = 1007.0
URANUS_X = 2136.0
NEPTUNE_X = 3410.0

SPACE_BG = "#10151c"
STAR = "#d8dce2"
RULER = "#cfd4da"

PLANETS = [
    {"name": "Earth", "distance": EARTH_X, "diameter": 1.0, "sprite": "earth.png", "time": 0.0, "label_distance": "0 m"},
    {"name": "Mars", "distance": MARS_X, "diameter": 0.532, "sprite": "mars.png", "time": 11.0, "label_distance": "61 m"},
    {"name": "Jupiter", "distance": JUPITER_X, "diameter": 10.97, "sprite": "jupiter.png", "time": 22.0, "label_distance": "494 m"},
    {"name": "Saturn", "distance": SATURN_X, "diameter": 9.45, "sprite": "saturn.png", "time": 31.0, "label_distance": "1.0 km"},
    {"name": "Uranus", "distance": URANUS_X, "diameter": 4.0, "sprite": "uranus.png", "time": 45.0, "label_distance": "2.1 km"},
    {"name": "Neptune", "distance": NEPTUNE_X, "diameter": 3.88, "sprite": "neptune.png", "time": 57.0, "label_distance": "3.4 km"},
]


def smoothstep(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def format_distance(meters: float) -> str:
    if meters >= 1000:
        return f"{meters / 1000:.2f} km"
    if meters >= 100:
        return f"{meters:.0f} m"
    if meters >= 10:
        return f"{meters:.1f} m"
    return f"{meters:.2f} m"


def segment_for_time(t: float) -> tuple[dict, dict, float]:
    for index in range(len(PLANETS) - 1):
        left = PLANETS[index]
        right = PLANETS[index + 1]
        if left["time"] <= t <= right["time"]:
            local = (t - left["time"]) / (right["time"] - left["time"])
            return left, right, local
    return PLANETS[-2], PLANETS[-1], 1.0


def hermite_position(t: float, t0: float, x0: float, t1: float, x1: float) -> float:
    duration = t1 - t0
    if duration <= 0:
        return x1
    s = max(0.0, min(1.0, (t - t0) / duration))
    h00 = 2 * s**3 - 3 * s**2 + 1
    h10 = s**3 - 2 * s**2 + s
    h01 = -2 * s**3 + 3 * s**2
    h11 = s**3 - s**2
    return h00 * x0 + h10 * duration * LOW_SPEED_MPS + h01 * x1 + h11 * duration * LOW_SPEED_MPS


def slow_window_bounds(index: int) -> tuple[float, float, float, float]:
    planet = PLANETS[index]
    if index == 0:
        return 0.0, EARTH_X, EARTH_SLOW_END, EARTH_X + LOW_SPEED_MPS * EARTH_SLOW_END
    center_t = float(planet["time"])
    center_x = float(planet["distance"])
    return (
        center_t - ENCOUNTER_HALF_TIME,
        center_x - LOW_SPEED_MPS * ENCOUNTER_HALF_TIME,
        center_t + ENCOUNTER_HALF_TIME,
        center_x + LOW_SPEED_MPS * ENCOUNTER_HALF_TIME,
    )


def camera_distance(t: float) -> float:
    first_start_t, first_start_x, first_end_t, first_end_x = slow_window_bounds(0)
    if t <= first_end_t:
        return first_start_x + LOW_SPEED_MPS * max(0.0, t - first_start_t)

    for index in range(1, len(PLANETS)):
        start_t, start_x, end_t, end_x = slow_window_bounds(index)
        if start_t <= t <= end_t:
            return start_x + LOW_SPEED_MPS * (t - start_t)

        prev_end_t, prev_end_x = slow_window_bounds(index - 1)[2:]
        if prev_end_t < t < start_t:
            return hermite_position(t, prev_end_t, prev_end_x, start_t, start_x)

    last_start_t, last_start_x, _last_end_t, _last_end_x = slow_window_bounds(len(PLANETS) - 1)
    return last_start_x + LOW_SPEED_MPS * (t - last_start_t)


def star_field() -> list[tuple[float, float, int, float]]:
    rng = random.Random(72)
    stars = []
    for _ in range(165):
        stars.append((rng.uniform(0, PIXEL_W), rng.uniform(35, 610), rng.choice((1, 1, 2)), rng.uniform(0.28, 1.0)))
    return stars


def draw_readouts(draw, distance: float, label_font, small_font) -> None:
    draw.text((96, 638), "Reference: Earth diameter = 1 cm", fill=hex_rgb(RULER), font=small_font)
    readout = f"Distance from Earth: {format_distance(distance)}"
    tw = draw.textlength(readout, font=label_font)
    draw.text((PIXEL_W - tw - 96, 638), readout, fill=hex_rgb(PAPER), font=label_font)


def planet_label(planet: dict) -> str:
    if planet["name"] == "Earth":
        return "Earth - travel begins here"
    return f"{planet['name']} - {planet['label_distance']} from Earth"


def draw_message(draw, text: str, message_font) -> None:
    max_width = 430
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and draw.textlength(candidate, font=message_font) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)

    x = 760
    y = 136
    for line in lines:
        draw.text((x, y), line, fill=hex_rgb(RULER), font=message_font)
        y += 30


def speed_display_km_s(local: float, right: dict) -> int:
    peak = 300_000
    ramp = math.sin(math.pi * max(0.0, min(1.0, local))) ** 2
    return int(1000 + ramp * (peak - 1000))


def slow_window_index(t: float) -> int | None:
    for index in range(len(PLANETS)):
        start_t, _start_x, end_t, _end_x = slow_window_bounds(index)
        if start_t <= t <= end_t:
            return index
    return None


def next_stop_for_time(t: float) -> dict:
    for index in range(1, len(PLANETS)):
        end_t = slow_window_bounds(index)[2]
        if t <= end_t:
            return PLANETS[index]
    return PLANETS[-1]


def displayed_speed_for_time(t: float) -> int:
    if slow_window_index(t) is not None:
        return 1000

    for index in range(1, len(PLANETS)):
        prev_end_t = slow_window_bounds(index - 1)[2]
        next_start_t = slow_window_bounds(index)[0]
        if prev_end_t < t < next_start_t:
            local = (t - prev_end_t) / (next_start_t - prev_end_t)
            return speed_display_km_s(local, PLANETS[index])

    return 1000


def render_fallback(
    video_path: Path = Path("img/outreach/solar-scale.mp4"),
    poster_path: Path = Path("img/outreach/solar-scale-poster.png"),
) -> None:
    from PIL import Image, ImageDraw

    label_font = font(25)
    small_font = font(21)
    title_font = font(32)
    stars = star_field()
    frame_count = int(RUN_TIME * FPS)
    sprite_dir = Path("img/outreach/planets")
    sprites = {
        str(planet["name"]): Image.open(sprite_dir / str(planet["sprite"])).convert("RGBA")
        for planet in PLANETS
    }

    def draw_planet_sprite(image: Image.Image, planet: dict, px: float, py: float, radius: float) -> None:
        sprite = sprites[str(planet["name"])]
        size = max(6, int(round(2 * radius)))
        resized = sprite.resize((size, size), Image.Resampling.LANCZOS)
        image.paste(resized, (int(round(px - size / 2)), int(round(py - size / 2))), resized)

    def draw_frame(frame_index: int) -> Image.Image:
        t = frame_index / FPS
        distance = camera_distance(t)
        image = Image.new("RGB", (PIXEL_W, PIXEL_H), hex_rgb(SPACE_BG))
        draw = ImageDraw.Draw(image, "RGBA")

        star_shift = distance * STAR_SHIFT_PER_METER
        for sx, sy, size, opacity in stars:
            x = (sx - star_shift * opacity) % PIXEL_W
            draw.ellipse((x - size, sy - size, x + size, sy + size), fill=hex_rgb(STAR) + (int(185 * opacity),))

        for planet in PLANETS:
            px = PIXEL_W / 2 + (float(planet["distance"]) - distance) * PIXELS_PER_METER
            radius = max(3.0, EARTH_RADIUS_PX * float(planet["diameter"]) * PLANET_DISPLAY_SCALE)
            if px + radius < -260 or px - radius > PIXEL_W + 260:
                continue
            py = 330
            draw_planet_sprite(image, planet, px, py, radius)
            label = planet_label(planet)
            tw = draw.textlength(label, font=label_font)
            draw.text((px - tw / 2, py + radius + 28), label, fill=hex_rgb(PAPER), font=label_font)

        next_text = planet_label(next_stop_for_time(t))
        speed_km_s = displayed_speed_for_time(t)
        draw.text((82, 58), f"v = {speed_km_s:,} km/s", fill=hex_rgb(PAPER), font=title_font)
        draw.text((82, 100), f"next scale stop: {next_text}", fill=hex_rgb(RULER), font=small_font)

        if 6.4 < t < 9.6:
            draw_message(draw, "Mars is 61 m away on this scale.", label_font)
        if t > 45.0:
            draw_message(draw, "Neptune is more than 3 km from Earth on the same scale.", label_font)

        draw_readouts(draw, distance, label_font, small_font)
        return image.convert("RGB")

    save_video_stream(draw_frame, frame_count, video_path, poster_path, poster_index=int(11.0 * FPS))


def main() -> None:
    parser = argparse.ArgumentParser(description="Render the Solar-system distance-scale animation.")
    parser.add_argument("--fallback-render", action="store_true")
    parser.add_argument("--video", type=Path, default=Path("img/outreach/solar-scale.mp4"))
    parser.add_argument("--poster", type=Path, default=Path("img/outreach/solar-scale-poster.png"))
    args = parser.parse_args()
    render_fallback(args.video, args.poster)


if __name__ == "__main__":
    main()
