import argparse
import os
import sys
import time
from pathlib import Path

# Make the existing conda CUDA DLLs available even outside an activated shell.
dlls = Path(sys.prefix) / "Library" / "bin"
if sys.platform == "win32" and dlls.is_dir():
    os.environ["PATH"] = str(dlls) + os.pathsep + os.environ["PATH"]
    dll_handle = os.add_dll_directory(str(dlls))

from common import IMAGES, OUT, RAW, VIDEOS, cv2, digest, enrollment_files, read_csv, rel_source, samples, save_image, tag, write_csv

BASE = OUT / "enrollment_candidates"
FIELDS = "crop_file preview_file source_video timestamp_sec det_score blur_score bbox assigned_id view_type".split()


def inspect(frame, detector):
    h, w = frame.shape[:2]
    scale = min(1, 1280 / max(w, h))
    small = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    found = []
    for detection in detector.detect_faces(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)):
        x, y, bw, bh = detection["box"]
        x1, y1 = max(0, round(x / scale)), max(0, round(y / scale))
        x2, y2 = min(w, round((x + bw) / scale)), min(h, round((y + bh) / scale))
        if x2 > x1 and y2 > y1:
            found.append(((x1, y1, x2, y2), detection["confidence"]))
    return sorted(found, key=lambda item: item[0])


def process(path, detector, args, rows):
    source = rel_source(path)
    video = path.suffix.lower() in VIDEOS
    sequence = samples(path, args.interval_sec) if video else [(0, cv2.imread(str(path)))]
    kept = frames = faces = 0
    start = time.perf_counter()
    for sec, frame in sequence:
        if frame is None:
            raise IOError(path)
        frames += 1
        boxes = inspect(frame, detector)
        faces += len(boxes)
        label = f"{path.stem}_t{sec:.3f}s"
        preview = BASE / "previews" / tag(path) / (label + ".jpg")
        annotated = frame.copy()
        saved = 0
        for i, (box, confidence) in enumerate(boxes):
            x, y, right, bottom = box
            cv2.rectangle(annotated, (x, y), (right, bottom), (0, 255, 0), 2)
            cv2.putText(annotated, f"F{i}", (x, max(18, y-3)), cv2.FONT_HERSHEY_SIMPLEX, .7, (0, 180, 0), 2)
            width, height = right-x, bottom-y
            if min(width, height) < args.min_face_px or (video and kept >= args.max_per_video):
                continue
            gray = cv2.cvtColor(frame[y:bottom, x:right], cv2.COLOR_BGR2GRAY)
            # Normalize every face crop to 160x160 so sharp close-ups aren't penalized.
            gray = cv2.resize(gray, (160, 160), interpolation=cv2.INTER_AREA)
            blur = cv2.Laplacian(gray, cv2.CV_64F).var()
            if blur < args.min_blur:
                continue
            mx, my = round(width*.2), round(height*.2)
            crop = BASE / "crops" / tag(path) / f"{label}_F{i}.jpg"
            key = crop.relative_to(BASE).as_posix()
            if key not in rows:
                save_image(crop, frame[max(0,y-my):bottom+my, max(0,x-mx):right+mx])
                rows[key] = dict(crop_file=key, preview_file=preview.relative_to(BASE).as_posix(),
                                 source_video=source, timestamp_sec=round(sec,3), det_score=round(confidence,5),
                                 blur_score=round(blur,2), bbox=str(box), assigned_id="", view_type="")
            elif not crop.is_file():
                save_image(crop, frame[max(0,y-my):bottom+my, max(0,x-mx):right+mx])
            kept += 1
            saved += 1
        if saved or (not video and len(boxes) > 1):
            save_image(preview, annotated)
        if video and kept >= args.max_per_video:
            break
    print(f"{source}: {frames} samples, {faces} detections, {kept} qualifying crops, {time.perf_counter()-start:.2f}s", flush=True)
    return faces, kept


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", nargs="+", required=True)
    parser.add_argument("--interval-sec", type=float, default=2.0)
    parser.add_argument("--min-face-px", type=int, default=60)
    parser.add_argument("--min-blur", type=float, default=50.0)
    parser.add_argument("--max-per-video", type=int, default=60)
    args = parser.parse_args()
    if min(args.interval_sec, args.min_face_px, args.max_per_video) <= 0 or args.min_blur < 0:
        parser.error("Invalid sampling or filter settings")
    import tensorflow as tf
    from mtcnn import MTCNN
    devices = tf.config.list_physical_devices("GPU")
    if not devices:
        raise RuntimeError("TensorFlow cannot see a GPU in this environment")
    for gpu in devices:
        tf.config.experimental.set_memory_growth(gpu, True)
    detector = MTCNN()
    print("MTCNN:", tf.config.experimental.get_device_details(devices[0]), flush=True)
    index = BASE / "crops_metadata.csv"
    rows = {r["crop_file"]: r for r in read_csv(index)}
    audit_path = BASE / "enrollment_photo_audit.csv"
    audit = {r["source"].replace("\\", "/"): r for r in read_csv(audit_path)}
    audit_fields = "source sha256 duplicate_of faces_detected qualifying_crops".split()
    tf.keras.utils.disable_interactive_logging()
    seen = {r["sha256"]: r["source"].replace("\\", "/") for r in audit.values() if not r.get("duplicate_of")}
    for source in args.source:
        for path in enrollment_files(source, VIDEOS | IMAGES):
            src = rel_source(path)
            if path.suffix.lower() in IMAGES:
                sha = digest(path)
                if sha in seen and seen[sha] != src:
                    print(f"Exact duplicate {path.name} -> {seen[sha]}", flush=True)
                    audit[src] = dict(source=src, sha256=sha, duplicate_of=seen[sha],
                                      faces_detected=audit[seen[sha]]["faces_detected"], qualifying_crops=0)
                    write_csv(audit_path, audit_fields, audit.values())
                    continue
                seen.setdefault(sha, src)
            faces, kept = process(path, detector, args, rows)
            if path.suffix.lower() in IMAGES:
                audit[src] = dict(source=src, sha256=sha, duplicate_of="",
                                  faces_detected=faces, qualifying_crops=kept)
                write_csv(audit_path, audit_fields, audit.values())
            write_csv(index, FIELDS, rows.values())


if __name__ == "__main__":
    main()
