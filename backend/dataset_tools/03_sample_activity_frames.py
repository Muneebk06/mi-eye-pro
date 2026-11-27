import argparse

from common import OUT, VIDEOS, enrollment_files, np, read_csv, rel_source, samples, save_image, tag, thumb, write_csv

FIELDS = ["frame_file", "source_video", "timestamp_sec", "phone_usage", "seating_label", "hard_negative", "notes"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", nargs="+", required=True, help="Selected student-facing clips")
    parser.add_argument("--interval-sec", type=float, default=4)
    parser.add_argument("--min-difference", type=float, default=3)
    args = parser.parse_args()
    if args.min_difference < 0:
        parser.error("min-difference must be nonnegative")
    index = OUT / "activity_frames_index.csv"
    rows = {r["frame_file"]: {k: r.get(k, "") for k in FIELDS} for r in read_csv(index)}
    angles = {r["source"]: r["camera_angle"] for r in read_csv(OUT / "manifest.csv")}
    for source in args.source:
        for path in enrollment_files(source, VIDEOS):
            src = rel_source(path)
            if angles.get(src) != "student_front":
                raise ValueError(f"Expected student_front clip, got {angles.get(src)!r}: {src}")
            previous = None
            for sec, frame in samples(path, args.interval_sec):
                current = thumb(frame)
                if previous is not None and np.abs(current - previous).mean() < args.min_difference:
                    continue
                previous = current
                target = OUT / "activity_frames" / tag(path) / f"{path.stem}_t{sec:.3f}s.jpg"
                key = target.relative_to(OUT).as_posix()
                if key not in rows:
                    save_image(target, frame)
                    rows[key] = dict(frame_file=key, source_video=src, timestamp_sec=round(sec, 3),
                                     phone_usage="", seating_label="", hard_negative="", notes="")
                elif not target.is_file():
                    save_image(target, frame)
            write_csv(index, FIELDS, rows.values())


if __name__ == "__main__":
    main()
