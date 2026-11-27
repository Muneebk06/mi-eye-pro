import json
import subprocess
from fractions import Fraction

from common import IMAGES, OUT, RAW, VIDEOS, capture, cv2, digest, files, np, read_csv, rel_source, tag, thumb, write_csv


def video_info(path):
    args = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", str(path)]
    stream = json.loads(subprocess.check_output(args))["streams"][0]
    rotation = stream.get("tags", {}).get("rotate", 0)
    for item in stream.get("side_data_list", []):
        if "rotation" in item:
            rotation = item["rotation"]
    return dict(width=stream["width"], height=stream["height"], rotation=int(float(rotation)),
                duration_sec=float(stream["duration"]), fps=float(Fraction(stream["avg_frame_rate"])))


def signature(path):
    cap = capture(path)
    result = []
    try:
        count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        for part in (0.1, 0.5, 0.9):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(count * part))
            ok, frame = cap.read()
            if not ok:
                raise IOError(path)
            result.append(thumb(frame))
    finally:
        cap.release()
    return np.stack(result)


def classify(path, prior):
    parts = path.resolve().relative_to(RAW).parts
    if parts[0] in {"enroll_pool", "eval_holdout"}:
        split, category = parts[:2]
        angle = prior.get("camera_angle") or (category if category != "enrollment_photos" else "")
        return split, angle
    if parts[0] in {"students", "teacher"}:
        return prior.get("split") or "enroll_pool", prior.get("camera_angle", "")
    if parts[0] == "Entry_check_point":
        return prior.get("split") or "eval_holdout", prior.get("camera_angle") or "gate"
    # Preserve existing split for classroom clips; fail safe to eval_holdout for unseen clips.
    return prior.get("split") or "eval_holdout", prior.get("camera_angle", "")


def main():
    dest = OUT / "manifest.csv"
    old = {r["source"].replace("\\", "/"): r for r in read_csv(dest)}
    rows, hashes, clips, signatures = [], {}, [], {}
    fields = "source folder filename sha256 exact_duplicate_of width height fps duration_sec rotation session_group camera_angle split asset_id".split()
    for path in files(".", VIDEOS | IMAGES):
        src = rel_source(path)
        sha = digest(path)
        prior = old.get(src, {})
        split, camera_angle = classify(path, prior)
        if split not in {"enroll_pool", "eval_holdout"}:
            raise ValueError(f"Invalid split for {src}: {split}")
        asset_id = tag(path)
        row = dict(asset_id=asset_id, source=src, folder=path.resolve().parent.relative_to(RAW).as_posix(),
                   filename=path.name, sha256=sha, exact_duplicate_of=hashes.get(sha, ""),
                   session_group=prior.get("session_group", asset_id),
                   camera_angle=camera_angle, split=split)
        if path.suffix.lower() in VIDEOS:
            row.update(video_info(path))
            for other, previous in clips:
                if abs(row["duration_sec"] - previous["duration_sec"]) > 0.2:
                    continue
                for clip in (other, path):
                    if clip not in signatures:
                        signatures[clip] = signature(clip)
                distances = np.abs(signatures[path] - signatures[other]).mean(axis=(1, 2))
                # Re-exports can change exposure while retaining the same composition.
                correlations = [np.corrcoef(a.ravel(), b.ravel())[0, 1]
                                for a, b in zip(signatures[path], signatures[other])]
                if max(distances) < 12 or all(value > 0.97 for value in correlations):
                    row["session_group"] = previous["session_group"]
                    break
            clips.append((path, row))
        else:
            frame = cv2.imread(str(path))
            if frame is None:
                raise IOError(path)
            row.update(width=frame.shape[1], height=frame.shape[0])
        if sha in hashes:
            row["session_group"] = next(r["session_group"] for r in rows if r["sha256"] == sha)
        hashes.setdefault(sha, src)
        rows.append(row)
    for group in {r["session_group"] for r in rows}:
        if len({r["split"] for r in rows if r["session_group"] == group}) > 1:
            raise ValueError(f"Session group spans splits: {group}")
    write_csv(dest, fields, rows)
    print(f"{len(rows)} assets -> {dest}")


if __name__ == "__main__":
    main()
