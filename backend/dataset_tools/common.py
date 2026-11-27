import csv
import hashlib
import os
from pathlib import Path

import cv2
import numpy as np

RAW = Path(r"C:\Users\Muneeb\PycharmProjects\Fyp_model\DataSet").resolve()
OUT = Path(r"C:\Users\Muneeb\PycharmProjects\Fyp_model\dataset_curated").resolve()
VIDEOS = {".mov", ".mp4"}
IMAGES = {".jpg", ".jpeg", ".png"}


def rel_source(path):
    return path.resolve().relative_to(RAW).as_posix()


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(2**20), b""):
            h.update(block)
    return h.hexdigest()


def files(source, types):
    path = (RAW / source).resolve(strict=True)
    path.relative_to(RAW)
    paths = path.rglob("*") if path.is_dir() else [path]
    return sorted(p for p in paths if p.is_file() and p.suffix.lower() in types)


def read_csv(path):
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    os.replace(tmp, path)


def save_image(path, image):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(path), image):
        raise IOError(path)


def capture(path):
    cap = cv2.VideoCapture(str(path), cv2.CAP_FFMPEG)
    if not cap.isOpened() or not cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1):
        cap.release()
        raise ValueError(f"Could not open with automatic rotation: {path}")
    return cap


def samples(path, interval):
    if not np.isfinite(interval) or interval <= 0:
        raise ValueError("interval must be positive")
    cap = capture(path)
    try:
        target = 0.0
        while cap.grab():
            sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
            if sec + 1e-6 < target:
                continue
            ok, frame = cap.retrieve()
            if not ok:
                raise IOError(path)
            yield sec, frame
            target += interval
    finally:
        cap.release()


def tag(path):
    key = rel_source(path)
    for row in read_csv(OUT / "manifest.csv"):
        if row["source"].replace("\\", "/") == key and row.get("asset_id"):
            return row["asset_id"]
    return hashlib.sha256(key.encode()).hexdigest()[:10]


def enrollment_files(source, types):
    manifest = read_csv(OUT / "manifest.csv")
    held = {r["session_group"] for r in manifest if r["split"].strip().lower() == "eval_holdout"}
    held.discard("")
    allowed = {
        r["source"].replace("\\", "/")
        for r in manifest
        if r["split"].strip().lower() == "enroll_pool" and r["session_group"] not in held
    }
    paths = files(source, types)
    for path in paths:
        key = rel_source(path)
        if key not in allowed:
            raise ValueError(f"Outside enrollment pool: {key}")
    return paths


def thumb(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return cv2.resize(gray, (64, 48), interpolation=cv2.INTER_AREA).astype("float32")
