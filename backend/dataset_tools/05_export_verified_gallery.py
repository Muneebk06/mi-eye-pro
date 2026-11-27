import argparse
import csv
import hashlib
import shutil
from pathlib import Path


DEFAULT = Path(r"C:\Users\Muneeb\PycharmProjects\Fyp_model\dataset_curated")
FOLDERS = {"student": "students", "teacher": "teachers", "unknown": "unknown"}
SUMMARY = "role assigned_id verified_count target_count missing_count view_breakdown status".split()


def read_rows(path, required):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        missing = set(required.split()) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path.name}: missing columns {sorted(missing)}")
        return list(reader)


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def safe_label(value):
    return (value and value not in {".", ".."} and not value.endswith((".", " "))
            and not Path(value).is_reserved()
            and all(c.isalnum() or c in " ._-" for c in value))


def identity(row):
    name = row["assigned_id"].strip()
    role = (row.get("role") or "").strip().lower()
    if name.lower() == "unknown" or role == "unknown":
        return "unknown", "unknown"
    if ":" in name:
        prefix, name = name.split(":", 1)
        if role and role != prefix.lower():
            raise ValueError("role disagrees with assigned_id prefix")
        role = prefix.lower()
    if role not in ("student", "teacher") or not safe_label(name):
        raise ValueError("use student:<ID>, teacher:<ID>, or a valid role column and ID")
    return role, name


def source_key(value):
    return value.strip().replace("\\", "/").casefold()


def export(root, target, dry):
    candidates = root / "enrollment_candidates"
    gallery = root / "enrollment_verified"
    rows = read_rows(candidates / "crops_metadata.csv", "crop_file source_video assigned_id view_type")
    manifest = read_rows(root / "manifest.csv", "source split session_group")
    sources = {source_key(r["source"]): r for r in manifest}
    held = {r["session_group"].strip() for r in manifest if r["split"].strip().lower() == "eval_holdout"}
    held.discard("")
    originals = sorted({Path(r["crop_file"]).name for r in rows}, key=len, reverse=True)
    inventory = {}
    spellings = {}
    reserved = set()
    added = skipped = duplicates = blocked = 0

    # Count distinct existing images too, including on repeated exports.
    for role, folder in FOLDERS.items():
        base = gallery / folder
        paths = base.glob("*/*") if role != "unknown" else base.glob("*")
        for path in paths:
            if not path.is_file() or path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                continue
            name = "unknown" if role == "unknown" else path.parent.name
            spellings[(role, name.casefold())] = name
            views = inventory.setdefault((role, name), {})
            prefix = name + "_"
            view = "unspecified"
            digest = sha256(path)
            for original in originals:
                if path.name.startswith(prefix) and path.name.endswith("_" + original):
                    view = path.name[len(prefix):-len(original)-1] or "na"
                    view = view.removesuffix("_" + digest)
                    break
            views[digest] = view
            reserved.add(path)

    if not any(r["assigned_id"].strip() for r in rows):
        print("Review the numbered previews and enter student:<ID> or teacher:<ID> in assigned_id.")
        print("Alternatively use a role column with a plain ID. Use unknown, skip or discard as needed.")

    for number, row in enumerate(rows, 2):
        source = sources.get(source_key(row["source_video"]))
        if source is None or source["split"].strip().lower() != "enroll_pool" or source["session_group"].strip() in held:
            reason = "missing from manifest" if source is None else "eval_holdout source or session group"
            print(f"[LEAKAGE BLOCKED] row {number}: {row['source_video']} ({reason})")
            blocked += 1
            continue
        if row["assigned_id"].strip().lower() in {"", "skip", "discard"}:
            skipped += 1
            continue
        try:
            role, name = identity(row)
            name = spellings.setdefault((role, name.casefold()), name)
            view = row["view_type"].strip() or "na"
            if not safe_label(view):
                raise ValueError("invalid view_type")
            crop = (candidates / row["crop_file"]).resolve(strict=True)
            crop.relative_to((candidates / "crops").resolve())
            if not crop.is_file():
                raise ValueError("missing crop file")
            dest = gallery / FOLDERS[role]
            if role != "unknown":
                dest = dest / name
            dest.resolve().relative_to(gallery.resolve())
            digest = sha256(crop)
        except (OSError, ValueError) as error:
            print(f"[SKIPPED] row {number}: {error}")
            skipped += 1
            continue
        views = inventory.setdefault((role, name), {})
        if digest in views:
            duplicates += 1
            continue
        path = dest / f"{name}_{view}_{crop.name}"
        if path in reserved or path.exists():
            path = dest / f"{name}_{view}_{digest}_{crop.name}"
        if not dry:
            dest.mkdir(parents=True, exist_ok=True)
            with crop.open("rb") as src, path.open("xb") as out:
                shutil.copyfileobj(src, out)
        print(f"{'Would copy' if dry else 'Copied'} {row['crop_file']} -> {path.relative_to(gallery)}")
        reserved.add(path)
        views[digest] = view
        added += 1

    summary = []
    print("Role     ID                   Count/target  Status")
    for (role, name), views in sorted(inventory.items()):
        count = len(views)
        missing = max(0, target-count)
        status = "UNASSIGNED" if role == "unknown" else (f"NEED {missing} MORE" if missing else "READY")
        breakdown = {v: list(views.values()).count(v) for v in sorted(set(views.values()))}
        tally = ", ".join(f"{v}={n}" for v, n in breakdown.items())
        summary.append([role, name, count, target, missing, tally, status])
        print(f"{role:8} {name:20} {count}/{target:<10}  {status}")
    if not summary:
        print("(no verified identities)")
    if not dry:
        gallery.mkdir(parents=True, exist_ok=True)
        path = gallery / "gallery_summary.csv"
        tmp = path.with_suffix(".tmp")
        with tmp.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.writer(stream)
            writer.writerow(SUMMARY)
            writer.writerows(summary)
        tmp.replace(path)
    print(f"{'Dry run' if dry else 'Export'}: copies={added}, skipped={skipped}, duplicates={duplicates}, leakage-blocked={blocked}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Copy manually verified face crops into an enrollment gallery.")
    parser.add_argument("--curated-dir", type=Path, default=DEFAULT)
    parser.add_argument("--target-per-person", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.target_per_person < 1:
        parser.error("--target-per-person must be positive")
    export(args.curated_dir, args.target_per_person, args.dry_run)
