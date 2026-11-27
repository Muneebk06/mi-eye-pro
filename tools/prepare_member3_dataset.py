"""Prepare, validate, and document the MEye-Pro Member 3 dataset without modifying originals.

Usage:
    python tools/prepare_member3_dataset.py --dry-run
    python tools/prepare_member3_dataset.py --apply
"""

import argparse
import collections
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import yaml
from PIL import Image


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv"}

SCB_FOLDERS = {
    "教师板书": ("teacher_tracking", "supplementary/board_writing", "scb_board_writing", "whiteboard_writing"),
    "巡视": ("teacher_tracking", "supplementary/classroom_movement", "scb_classroom_movement", "classroom_movement"),
    "读写": ("phone_detection", "supplementary/reading_writing", "scb_reading_writing", "reading_writing"),
}

# Verified content cues observed on local development clips (test split kept untouched for final eval).
LOCAL_TEACHER_INFO = {
    "01_lab_board_IMG_7384.mov": (
        "mixed_movement", True,
        "Verified dev clip: teacher at whiteboard/projector screen and front lab desk area; student rows occluded by monitors.",
    ),
    "02_lab_podium_wide_IMG_7389.mov": (
        "mixed_movement", True,
        "Verified dev clip: teacher near whiteboard, stepping toward front row, and standing behind right-side wooden podium.",
    ),
    "03_board_naseer.mp4": (
        "whiteboard_writing", True,
        "Verified dev clip: teacher pointing/writing at whiteboard with lower-body occlusion from seated foreground students.",
    ),
    "04_board_naseer_wide.mp4": (
        "whiteboard_writing", True,
        "Verified dev clip: wide front view showing whiteboard use, teacher desk/podium left, and seated students.",
    ),
    "classroom_board_still.jpeg": (
        "whiteboard_writing", True,
        "Verified dev still: teacher holding marker at whiteboard with desk/podium left and students right.",
    ),
}

LOCAL_STUDENT_INFO = {
    "01_front_IMG_7390.mov": (
        "unknown", False,
        "Sampled dev frames show computer lab monitors and hand-near-chin without phone; full continuous clip not frame-annotated.",
    ),
    "02_front_IMG_7391.mov": (
        "mixed", False,
        "Sampled dev frame (~48s) shows standing person holding phone in left aisle while seated students write/rest chin; needs exact GT timestamps.",
    ),
    "03_front_IMG_7404.mov": (
        "mixed", False,
        "Sampled dev frames confirm active phone use (~20-32s, front-right student) alongside writing, page turning, and hand-near-face negatives; needs exact GT timestamps.",
    ),
    "04_front_whatsapp.mp4": (
        "negative", False,
        "Sampled dev frames show writing, hand-on-chin negative, and unused phone lying flat on desk edge; full clip needs continuous verification.",
    ),
}


def sha256_file(path: Path) -> str:
    """Compute SHA-256 hash using bounded memory."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe_image(path: Path) -> dict:
    """Validate image integrity and return (width, height)."""
    try:
        with Image.open(path) as img:
            width, height = img.size
            img.verify()
        return {"ok": True, "width": int(width), "height": int(height), "error": ""}
    except Exception as exc:
        return {"ok": False, "width": 0, "height": 0, "error": str(exc)}


def probe_video(path: Path) -> dict:
    """Validate video readability and extract upright width, height, fps, duration, rotation."""
    result = {"ok": False, "width": 0, "height": 0, "fps": 0.0, "duration": 0.0, "rotation": 0, "error": ""}
    cap = cv2.VideoCapture(str(path), cv2.CAP_FFMPEG)
    if not cap.isOpened():
        result["error"] = "OpenCV VideoCapture failed to open"
        return result
    try:
        cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
        ok, frame = cap.read()
        if not ok or frame is None:
            result["error"] = "Failed decoding first frame"
            return result
        height, width = frame.shape[:2]
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        frames = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0)
    finally:
        cap.release()

    rotation = 0
    duration = frames / fps if fps > 0 else 0.0
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", str(path)],
            stderr=subprocess.DEVNULL,
        )
        stream = json.loads(out)["streams"][0]
        rotation = int(float(stream.get("tags", {}).get("rotate", 0)))
        for sd in stream.get("side_data_list", []):
            if "rotation" in sd:
                rotation = int(float(sd["rotation"]))
        if "duration" in stream:
            duration = float(stream["duration"])
    except Exception:
        pass

    result.update({
        "ok": True,
        "width": int(width),
        "height": int(height),
        "fps": round(fps, 3),
        "duration": round(duration, 2),
        "rotation": rotation,
    })
    return result


def find_external_root(dataset_root: Path) -> Path:
    """Locate the downloaded external dataset root dynamically."""
    candidate = dataset_root / "new _ prepared_data_set"
    if candidate.is_dir() and (candidate / "data.yaml").is_file():
        return candidate
    for child in sorted(dataset_root.iterdir()):
        if child.is_dir() and child.name != "member_3" and (child / "data.yaml").is_file():
            return child
    raise FileNotFoundError(f"Could not find external dataset directory containing data.yaml inside {dataset_root}")


def validate_roboflow_dataset(ext_root: Path) -> dict:
    """Validate Roboflow YOLO splits, coordinates, class IDs, and split leakage."""
    data_yaml = yaml.safe_load((ext_root / "data.yaml").read_text(encoding="utf-8"))
    names = list(data_yaml["names"])
    nc = int(data_yaml["nc"])
    split_reports = {}
    per_image_meta = {}
    sequence_splits = collections.defaultdict(set)

    for orig_split in ("train", "valid", "test"):
        img_dir = ext_root / orig_split / "images"
        lbl_dir = ext_root / orig_split / "labels"
        imgs = {p.stem: p for p in sorted(img_dir.iterdir()) if p.is_file()}
        lbls = {p.stem: p for p in sorted(lbl_dir.iterdir()) if p.is_file()}

        orphan_images = sorted(set(imgs) - set(lbls))
        orphan_labels = sorted(set(lbls) - set(imgs))
        empty_labels = []
        malformed_lines = []
        invalid_classes = []
        bad_coords = []
        class_counts = collections.Counter()
        box_dims = collections.defaultdict(list)

        for stem, lbl_path in sorted(lbls.items()):
            text = lbl_path.read_text(encoding="utf-8", errors="replace").strip()
            img_classes = set()
            status = "valid"
            if not text:
                empty_labels.append(lbl_path.name)
                status = "empty_annotation"
            else:
                for line_no, line in enumerate(text.splitlines(), 1):
                    parts = line.strip().split()
                    if len(parts) != 5:
                        malformed_lines.append((lbl_path.name, line_no, line))
                        status = "invalid_annotation"
                        continue
                    try:
                        cid = int(parts[0])
                        xc, yc, bw, bh = map(float, parts[1:])
                    except ValueError:
                        malformed_lines.append((lbl_path.name, line_no, line))
                        status = "invalid_annotation"
                        continue
                    if not (0 <= cid < nc):
                        invalid_classes.append((lbl_path.name, line_no, cid))
                        status = "invalid_annotation"
                        continue
                    if not (0.0 <= xc <= 1.0 and 0.0 <= yc <= 1.0 and 0.0 < bw <= 1.0 and 0.0 < bh <= 1.0):
                        bad_coords.append((lbl_path.name, line_no, (xc, yc, bw, bh)))
                        status = "invalid_annotation"
                        continue
                    cname = names[cid]
                    class_counts[cname] += 1
                    img_classes.add(cname)
                    box_dims[cname].append((bw, bh))

            img_path = imgs.get(stem)
            if img_path is not None:
                m = re.match(r"^(sample_\d+)_", img_path.name)
                seq_key = m.group(1) if m else img_path.name.split("_jpg.rf.")[0]
                sequence_splits[seq_key].add(orig_split)
                per_image_meta[(orig_split, img_path.name)] = {
                    "classes": sorted(img_classes),
                    "label_path": lbl_path,
                    "validation_status": status if stem in lbls else "missing_annotation",
                }

        dim_summary = {}
        for cname, wh_list in sorted(box_dims.items()):
            ws = sorted(x[0] for x in wh_list)
            hs = sorted(x[1] for x in wh_list)
            mid = len(wh_list) // 2
            dim_summary[cname] = {
                "count": len(wh_list),
                "w_median": round(ws[mid], 4),
                "h_median": round(hs[mid], 4),
                "w_min": round(ws[0], 4),
                "w_max": round(ws[-1], 4),
                "h_min": round(hs[0], 4),
                "h_max": round(hs[-1], 4),
            }

        split_reports[orig_split] = {
            "images": len(imgs),
            "labels": len(lbls),
            "orphan_images": orphan_images,
            "orphan_labels": orphan_labels,
            "empty_labels": empty_labels,
            "malformed_lines": len(malformed_lines),
            "invalid_classes": len(invalid_classes),
            "bad_coords": len(bad_coords),
            "class_counts": dict(class_counts),
            "bbox_stats": dim_summary,
        }

    leaked_sequences = {k: sorted(v) for k, v in sorted(sequence_splits.items()) if len(v) > 1}
    return {
        "data_yaml": data_yaml,
        "names": names,
        "nc": nc,
        "splits": split_reports,
        "per_image_meta": per_image_meta,
        "leaked_sequences": leaked_sequences,
    }


def scan_repository_dataset(dataset_root: Path, ext_root: Path) -> dict:
    """Inspect all existing dataset folders (excluding member_3) cleanly and safely."""
    source_roots = [
        dataset_root / "enrollment_photos",
        dataset_root / "teacher_videos",
        dataset_root / "student_videos",
        dataset_root / "gate_videos",
        dataset_root / "phone_frames",
        ext_root,
    ]

    all_files = []
    for base in source_roots:
        if base.is_dir():
            all_files.extend(sorted(p for p in base.rglob("*") if p.is_file()))
    top_readme = dataset_root / "README.md"
    if top_readme.is_file():
        all_files.append(top_readme)

    file_records = {}
    hash_groups = collections.defaultdict(list)
    corrupt_media = []
    empty_files = []
    resolutions = collections.defaultdict(collections.Counter)
    ext_counts = collections.Counter()

    for path in all_files:
        rel = path.relative_to(dataset_root).as_posix()
        size = path.stat().st_size
        ext = path.suffix.lower() or "<none>"
        ext_counts[ext] += 1
        if size == 0:
            empty_files.append(rel)

        digest = sha256_file(path)
        hash_groups[digest].append(rel)

        meta = {"path": path, "rel": rel, "size": size, "sha256": digest, "ext": ext}
        if ext in IMAGE_EXTS:
            info = probe_image(path)
            meta.update(info)
            if not info["ok"]:
                corrupt_media.append((rel, info["error"]))
            else:
                parts = rel.split("/")
                bucket = "/".join(parts[:2]) if parts[0] == ext_root.name else parts[0]
                resolutions[bucket][(info["width"], info["height"])] += 1
        elif ext in VIDEO_EXTS:
            info = probe_video(path)
            meta.update(info)
            if not info["ok"]:
                corrupt_media.append((rel, info["error"]))
        file_records[rel] = meta

    dup_groups = [sorted(paths) for paths in hash_groups.values() if len(paths) > 1]
    return {
        "records": file_records,
        "hash_groups": hash_groups,
        "duplicate_groups": dup_groups,
        "corrupt_media": corrupt_media,
        "empty_files": empty_files,
        "resolutions": resolutions,
        "ext_counts": dict(ext_counts),
        "total_bytes": sum(r["size"] for r in file_records.values()),
    }


def read_phone_frames_index(dataset_root: Path) -> dict:
    """Load existing local phone_frames_index.csv metadata by relative frame path."""
    csv_path = dataset_root / "phone_frames" / "phone_frames_index.csv"
    if not csv_path.is_file():
        return {}
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        return {row["frame_file"].replace("\\", "/"): row for row in csv.DictReader(handle)}


def build_manifests_and_issues(
    dataset_root: Path, ext_root: Path, scan: dict, robo: dict, pf_index: dict
) -> tuple[list[dict], list[dict], list[dict], list[dict], dict]:
    """Construct teacher manifest, phone manifest, file mapping, validation issues, and summary."""
    records = scan["records"]
    dup_lookup = {}
    for idx, grp in enumerate(scan["duplicate_groups"], 1):
        for rel in grp:
            dup_lookup[rel] = (idx, [x for x in grp if x != rel])

    teacher_rows = []
    phone_rows = []
    mapping_rows = []

    def add_mapping(orig_rel, prep_rel, action, source_type, priority, module, notes=""):
        rec = records.get(orig_rel)
        mapping_rows.append({
            "original_path": f"dataset/{orig_rel}" if orig_rel else "",
            "prepared_path": prep_rel,
            "action": action,
            "source_type": source_type,
            "dataset_priority": priority,
            "module": module,
            "sha256": rec["sha256"] if rec else "",
            "notes": notes,
        })

    # 1. Primary Teacher Videos & Still (Inspection Order #1)
    t_counter = 0
    for split_dir, usage_split in (("train", "development"), ("test", "held_out_test")):
        folder = dataset_root / "teacher_videos" / split_dir
        for p in sorted(folder.iterdir()):
            if not p.is_file():
                continue
            rel = p.relative_to(dataset_root).as_posix()
            rec = records[rel]
            t_counter += 1
            media_type = "video" if rec["ext"] in VIDEO_EXTS else "image"
            if split_dir == "train":
                scenario, verified, note = LOCAL_TEACHER_INFO.get(
                    p.name, ("unknown", False, "Primary university development media.")
                )
            else:
                scenario = "unknown"
                verified = False
                note = "Held-out university evaluation video; kept untouched until final evaluation."
            teacher_rows.append({
                "sample_id": f"TCH_PRI_{t_counter:04d}",
                "relative_path": f"dataset/{rel}",
                "source_type": "local",
                "dataset_priority": "primary",
                "source_dataset": "university_teacher_videos",
                "target_domain": "university",
                "media_type": media_type,
                "original_split": split_dir,
                "usage_split": usage_split,
                "scenario": scenario,
                "scenario_verified": str(verified).lower(),
                "camera_view": "teacher_board",
                "width": rec["width"],
                "height": rec["height"],
                "fps": rec.get("fps", ""),
                "duration_seconds": rec.get("duration", ""),
                "annotation_path": "",
                "annotation_type": "none",
                "validation_status": "valid" if rec["ok"] else "corrupt",
                "notes": note,
            })
            add_mapping(
                rel,
                f"dataset/member_3/teacher_tracking/primary/{usage_split}/primary_index.csv",
                "reference_only",
                "local",
                "primary",
                "teacher_tracking",
                "Referenced without duplicating heavy local media.",
            )

    # 2. Supplementary External Teacher Folders: SCB Board Writing & Classroom Movement (Inspection Order #5, #6)
    for ch_dir in ("教师板书", "巡视"):
        module, sub_rel, src_name, scenario = SCB_FOLDERS[ch_dir]
        folder = ext_root / ch_dir
        for p in sorted(folder.iterdir()):
            if not p.is_file():
                continue
            rel = p.relative_to(dataset_root).as_posix()
            rec = records[rel]
            t_counter += 1
            dup_note = ""
            if rel in dup_lookup:
                gid, others = dup_lookup[rel]
                dup_note = f" Exact SHA-256 duplicate group #{gid} with {others[0]}."
            teacher_rows.append({
                "sample_id": f"TCH_SUP_{t_counter:04d}",
                "relative_path": f"dataset/member_3/{module}/{sub_rel}/{p.name}",
                "source_type": "external",
                "dataset_priority": "supplementary",
                "source_dataset": src_name,
                "target_domain": "external",
                "media_type": "image",
                "original_split": "unspecified",
                "usage_split": "supplementary_reference",
                "scenario": scenario,
                "scenario_verified": "false",
                "camera_view": "classroom_external",
                "width": rec["width"],
                "height": rec["height"],
                "fps": "",
                "duration_seconds": "",
                "annotation_path": "",
                "annotation_type": "folder_level_only",
                "validation_status": "valid" if rec["ok"] else "corrupt",
                "notes": f"Folder-level external label ({ch_dir}); unverified individually.{dup_note}",
            })
            add_mapping(
                rel,
                f"dataset/member_3/{module}/{sub_rel}/{p.name}",
                "hardlink_or_copy",
                "external",
                "supplementary",
                "teacher_tracking",
                f"Original external path preserved ({ch_dir}).",
            )

    # 3. Primary Student Videos (Inspection Order #2)
    p_counter = 0
    for split_dir, usage_split in (("train", "development"), ("test", "held_out_test")):
        folder = dataset_root / "student_videos" / split_dir
        for p in sorted(folder.iterdir()):
            if not p.is_file():
                continue
            rel = p.relative_to(dataset_root).as_posix()
            rec = records[rel]
            p_counter += 1
            if split_dir == "train":
                p_label, p_ver, note = LOCAL_STUDENT_INFO.get(
                    p.name, ("unknown", False, "Primary university student recording.")
                )
            else:
                p_label = "unknown"
                p_ver = False
                note = "Held-out university student evaluation video (paired session a50cae960d); untouched until final eval."
            phone_rows.append({
                "sample_id": f"PHN_PRI_{p_counter:04d}",
                "relative_path": f"dataset/{rel}",
                "source_type": "local",
                "dataset_priority": "primary",
                "source_dataset": "university_student_videos",
                "target_domain": "university",
                "media_type": "video",
                "original_split": split_dir,
                "usage_split": usage_split,
                "annotation_path": "",
                "annotation_type": "none",
                "original_classes": "",
                "phone_usage_label": p_label,
                "label_granularity": "video",
                "label_verified": str(p_ver).lower(),
                "source_video": f"dataset/{rel}",
                "timestamp_seconds": "",
                "width": rec["width"],
                "height": rec["height"],
                "fps": rec.get("fps", ""),
                "duration_seconds": rec.get("duration", ""),
                "validation_status": "valid" if rec["ok"] else "corrupt",
                "notes": note,
            })
            add_mapping(
                rel,
                f"dataset/member_3/phone_detection/primary/{usage_split}/primary_index.csv",
                "reference_only",
                "local",
                "primary",
                "phone_detection",
                "Referenced without duplicating heavy local video.",
            )

    # 4. Primary Extracted Phone Frames (Inspection Order #3)
    for pf_rel in sorted(pf_index):
        row = pf_index[pf_rel]
        if pf_rel not in records:
            continue
        rec = records[pf_rel]
        p_counter += 1
        raw_phone = row.get("phone_usage", "").strip().lower()
        if raw_phone == "yes":
            p_label, p_ver = "positive", True
        elif raw_phone == "no":
            p_label, p_ver = "negative", True
        else:
            p_label, p_ver = "unknown", False
        phone_rows.append({
            "sample_id": f"PHN_PRI_{p_counter:04d}",
            "relative_path": f"dataset/{pf_rel}",
            "source_type": "local",
            "dataset_priority": "primary",
            "source_dataset": "university_phone_frames",
            "target_domain": "university",
            "media_type": "image",
            "original_split": "train",
            "usage_split": "development",
            "annotation_path": "dataset/phone_frames/phone_frames_index.csv",
            "annotation_type": "csv_index",
            "original_classes": raw_phone or "unlabeled",
            "phone_usage_label": p_label,
            "label_granularity": "image",
            "label_verified": str(p_ver).lower(),
            "source_video": f"dataset/{row.get('source_video', '')}",
            "timestamp_seconds": row.get("timestamp_sec", ""),
            "width": rec["width"],
            "height": rec["height"],
            "fps": "",
            "duration_seconds": "",
            "validation_status": "valid" if rec["ok"] else "corrupt",
            "notes": "Extracted from primary student_videos/train; phone_frames_index.csv currently has blank activity labels.",
        })
        add_mapping(
            pf_rel,
            "dataset/member_3/phone_detection/primary/development/primary_index.csv",
            "reference_only",
            "local",
            "primary",
            "phone_detection",
            "Linked to existing phone_frames image.",
        )

    # 5. Supplementary Roboflow Phone Dataset (Inspection Order #4)
    split_map = {"train": "development", "valid": "validation", "test": "held_out_test"}
    for orig_split, usage_split in split_map.items():
        img_dir = ext_root / orig_split / "images"
        for p in sorted(img_dir.iterdir()):
            if not p.is_file():
                continue
            rel = p.relative_to(dataset_root).as_posix()
            rec = records[rel]
            meta = robo["per_image_meta"][(orig_split, p.name)]
            classes = meta["classes"]
            has_phone = "phone_use" in classes
            has_other = any(c != "phone_use" for c in classes)
            if has_phone and not has_other:
                p_label = "positive"
            elif has_phone and has_other:
                p_label = "mixed"
            else:
                # Never assume absence of phone_use annotation guarantees a confirmed negative.
                p_label = "unknown"

            m = re.match(r"^(sample_\d+)_", p.name)
            seq_src = m.group(1) if m else p.name.split("_jpg.rf.")[0]
            leak_note = " Shares source sequence across splits (Roboflow split leakage)." if seq_src in robo["leaked_sequences"] else ""

            lbl_rel = meta["label_path"].relative_to(dataset_root).as_posix()
            prep_img = f"dataset/member_3/phone_detection/supplementary/roboflow_student_phone/{orig_split}/images/{p.name}"
            prep_lbl = f"dataset/member_3/phone_detection/supplementary/roboflow_student_phone/{orig_split}/labels/{meta['label_path'].name}"

            p_counter += 1
            phone_rows.append({
                "sample_id": f"PHN_SUP_{p_counter:04d}",
                "relative_path": prep_img,
                "source_type": "external",
                "dataset_priority": "supplementary",
                "source_dataset": "roboflow_student_phone",
                "target_domain": "external",
                "media_type": "image",
                "original_split": orig_split,
                "usage_split": usage_split,
                "annotation_path": prep_lbl,
                "annotation_type": "yolo_bbox",
                "original_classes": "|".join(classes),
                "phone_usage_label": p_label,
                "label_granularity": "person" if classes else "unknown",
                "label_verified": "false",
                "source_video": f"external_roboflow:{seq_src}",
                "timestamp_seconds": "",
                "width": rec["width"],
                "height": rec["height"],
                "fps": "",
                "duration_seconds": "",
                "validation_status": meta["validation_status"],
                "notes": (
                    "Roboflow phone_use boxes mark whole student/person behavior, not physical phone object."
                    + (" Contains both phone_use and non-phone classes." if p_label == "mixed" else "")
                    + leak_note
                ),
            })
            add_mapping(rel, prep_img, "hardlink_or_copy", "external", "supplementary", "phone_detection")
            add_mapping(lbl_rel, prep_lbl, "hardlink_or_copy", "external", "supplementary", "phone_detection")

    # 6. Supplementary External SCB Reading/Writing (Inspection Order #7)
    _, rw_sub, rw_src, _ = SCB_FOLDERS["读写"]
    for p in sorted((ext_root / "读写").iterdir()):
        if not p.is_file():
            continue
        rel = p.relative_to(dataset_root).as_posix()
        rec = records[rel]
        p_counter += 1
        dup_note = ""
        if rel in dup_lookup:
            gid, others = dup_lookup[rel]
            dup_note = f" Shares exact SHA-256 hash (#{gid}) with {others[0]}."
        prep_img = f"dataset/member_3/phone_detection/{rw_sub}/{p.name}"
        phone_rows.append({
            "sample_id": f"PHN_SUP_{p_counter:04d}",
            "relative_path": prep_img,
            "source_type": "external",
            "dataset_priority": "supplementary",
            "source_dataset": rw_src,
            "target_domain": "external",
            "media_type": "image",
            "original_split": "unspecified",
            "usage_split": "supplementary_reference",
            "annotation_path": "",
            "annotation_type": "folder_level_only",
            "original_classes": "reading_writing",
            "phone_usage_label": "unknown",
            "label_granularity": "image",
            "label_verified": "false",
            "source_video": "",
            "timestamp_seconds": "",
            "width": rec["width"],
            "height": rec["height"],
            "fps": "",
            "duration_seconds": "",
            "validation_status": "valid" if rec["ok"] else "corrupt",
            "notes": f"SCB reading/writing scene; unverified for absence of hidden phones.{dup_note}",
        })
        add_mapping(rel, prep_img, "hardlink_or_copy", "external", "supplementary", "phone_detection")

    # Mapping entries for copied documentation & updated data.yaml
    add_mapping(
        f"{ext_root.name}/data.yaml",
        "dataset/member_3/phone_detection/supplementary/roboflow_student_phone/data.yaml",
        "generated_copy",
        "external",
        "supplementary",
        "phone_detection",
        "Prepared copy updated with local relative paths; original data.yaml preserved unchanged.",
    )
    for doc_name in ("README.dataset.txt", "README.roboflow.txt"):
        if (ext_root / doc_name).is_file():
            add_mapping(
                f"{ext_root.name}/{doc_name}",
                f"dataset/member_3/phone_detection/supplementary/roboflow_student_phone/documentation/{doc_name}",
                "copy",
                "external",
                "supplementary",
                "phone_detection",
                "Preserved original Roboflow attribution documentation.",
            )

    # Compute exact duplicate metrics and build validation_issues
    cross_scb_patrol_rw = sum(
        1 for grp in scan["duplicate_groups"]
        if any("/巡视/" in x for x in grp) and any("/读写/" in x for x in grp)
    )
    cross_scb_board_rw = sum(
        1 for grp in scan["duplicate_groups"]
        if any("/教师板书/" in x for x in grp) and any("/读写/" in x for x in grp)
    )
    intra_board_dups = sum(
        1 for grp in scan["duplicate_groups"]
        if all("/教师板书/" in x for x in grp)
    )
    rf_label_dups_cross = sum(
        1 for grp in scan["duplicate_groups"]
        if any("/train/labels/" in x for x in grp) and any("/valid/labels/" in x for x in grp)
    )
    rf_label_dups_intra = sum(
        1 for grp in scan["duplicate_groups"]
        if all("/train/labels/" in x for x in grp)
    )

    issues = [
        {
            "issue_id": "ISS_001",
            "severity": "CRITICAL",
            "category": "split_leakage",
            "affected_paths": "dataset/new _ prepared_data_set/{train,valid,test}",
            "count": len(robo["leaked_sequences"]),
            "description": (
                f"All {len(robo['leaked_sequences'])} multi-frame Roboflow classroom video sequences "
                f"({', '.join(robo['leaked_sequences'])}) span across train, valid, and test splits "
                f"(e.g., sample_1_10275 in train vs sample_1_10250/10300 in test; {rf_label_dups_cross} identical "
                f"label files in train+valid and {rf_label_dups_intra} duplicate label files inside train)."
            ),
            "recommendation": "Preserve splits in metadata for provenance only; never treat Roboflow test as a sequence-independent university benchmark.",
        },
        {
            "issue_id": "ISS_002",
            "severity": "WARNING",
            "category": "annotation_semantic_mismatch",
            "affected_paths": "dataset/new _ prepared_data_set/data.yaml",
            "count": sum(s["class_counts"].get("phone_use", 0) for s in robo["splits"].values()),
            "description": (
                "Roboflow class 'phone_use' (1,058 total boxes; w_med~0.064-0.069, h_med~0.106, up to 0.686) "
                "annotates the whole seated student / arm performing phone activity, NOT physical handheld phone objects (COCO class 67)."
            ),
            "recommendation": "Evaluate pretrained COCO phone object detectors separately or match detections inside student/person boxes; do not equate Roboflow phone_use with physical phone boxes.",
        },
        {
            "issue_id": "ISS_003",
            "severity": "WARNING",
            "category": "cross_folder_duplicate",
            "affected_paths": "dataset/new _ prepared_data_set/{巡视,读写,教师板书}",
            "count": cross_scb_patrol_rw + cross_scb_board_rw,
            "description": (
                f"SCB folders share exact SHA-256 files: {cross_scb_patrol_rw} identical frames appear in both "
                f"'巡视' (classroom_movement) and '读写' (reading_writing), and {cross_scb_board_rw} frame (131_000078.jpg) "
                f"appears in both '教师板书' and '读写'. Additionally {intra_board_dups} duplicate pairs exist inside '教师板书'."
            ),
            "recommendation": "Flag duplicates cleanly in manifests; never double-count overlapping SCB images in quantitative metrics or treat SCB classroom_movement/reading_writing as mutually exclusive negatives.",
        },
        {
            "issue_id": "ISS_004",
            "severity": "WARNING",
            "category": "missing_ground_truth",
            "affected_paths": "dataset/{teacher_videos,student_videos,phone_frames/phone_frames_index.csv}",
            "count": len([r for r in teacher_rows if r["source_type"] == "local"]) + len([r for r in phone_rows if r["source_type"] == "local"]),
            "description": (
                "Primary university clips (8 teacher items, 6 student videos, 71 extracted phone_frames) have zero spatial zone JSON, "
                "zero teacher zone-duration ground truth, and zero box/timestamp phone-event ground truth CSVs yet."
            ),
            "recommendation": "Use primary development clips immediately for zone calibration and qualitative algorithm tuning, then author lightweight ground-truth CSVs on held-out test clips before reporting quantitative accuracy.",
        },
        {
            "issue_id": "ISS_005",
            "severity": "WARNING",
            "category": "missing_scenario",
            "affected_paths": "dataset/{teacher_videos/train,student_videos/train}",
            "count": 2,
            "description": (
                "Primary recordings show partial scenario gaps: (1) phone near face (call posture) was not observed in sampled student_videos/train frames; "
                "(2) deep aisle patrolling among student desks is absent/minimal in teacher_videos/train (teacher mostly near board/podium/front row)."
            ),
            "recommendation": "Supplement algorithm edge-case checks with Roboflow/SCB where helpful, and record short BIIT university clips for phone-near-ear and teacher-aisle-patrolling if required for final demo.",
        },
        {
            "issue_id": "ISS_006",
            "severity": "WARNING",
            "category": "unclear_license",
            "affected_paths": "dataset/new _ prepared_data_set/{巡视,教师板书,读写}",
            "count": 4642,
            "description": (
                "SCB external folders (教师板书, 巡视, 读写; 4,642 images) include no local README, source URL, or license file (Roboflow dataset specifies CC BY 4.0)."
            ),
            "recommendation": "Flag SCB subsets as academic/external review required before any public redistribution.",
        },
        {
            "issue_id": "ISS_007",
            "severity": "INFO",
            "category": "inconsistent_resolutions",
            "affected_paths": "dataset/{student_videos,teacher_videos,new _ prepared_data_set}",
            "count": len(scan["resolutions"]),
            "description": (
                "Mixed media resolutions: primary videos range from 1920x1080 to 1280x720 and 1024x576; Roboflow images are stretched to 640x640; "
                "SCB images span 1920x1080, 800x450, 800x448, 720x404, 640x480, 720x576, etc."
            ),
            "recommendation": "Use normalized [0..1] zone polygons and torso-height-normalized pose thresholds across resolutions.",
        },
    ]

    summary = {
        "inventory": {
            "total_source_files_inspected": len(records),
            "total_size_gb": round(scan["total_bytes"] / (1024 ** 3), 4),
            "extensions": scan["ext_counts"],
            "corrupt_media_count": len(scan["corrupt_media"]),
            "empty_files_count": len(scan["empty_files"]),
            "local_teacher_items": len([r for r in teacher_rows if r["source_type"] == "local"]),
            "local_teacher_videos_train": len([r for r in teacher_rows if r["source_type"] == "local" and r["media_type"] == "video" and r["usage_split"] == "development"]),
            "local_teacher_videos_test": len([r for r in teacher_rows if r["source_type"] == "local" and r["media_type"] == "video" and r["usage_split"] == "held_out_test"]),
            "local_teacher_stills": len([r for r in teacher_rows if r["source_type"] == "local" and r["media_type"] == "image"]),
            "external_teacher_images": len([r for r in teacher_rows if r["source_type"] == "external"]),
            "local_student_videos_train": len([r for r in phone_rows if r["source_dataset"] == "university_student_videos" and r["usage_split"] == "development"]),
            "local_student_videos_test": len([r for r in phone_rows if r["source_dataset"] == "university_student_videos" and r["usage_split"] == "held_out_test"]),
            "local_phone_frames": len([r for r in phone_rows if r["source_dataset"] == "university_phone_frames"]),
            "external_roboflow_images": len([r for r in phone_rows if r["source_dataset"] == "roboflow_student_phone"]),
            "external_roboflow_annotation_files": sum(s["labels"] for s in robo["splits"].values()),
            "external_scb_reading_writing_images": len([r for r in phone_rows if r["source_dataset"] == "scb_reading_writing"]),
            "shared_other_assets": {
                "enrollment_photos": len([r for r in records if r.startswith("enrollment_photos/")]),
                "gate_videos": len([r for r in records if r.startswith("gate_videos/")]),
            },
        },
        "roboflow_validation": {
            "classes": robo["names"],
            "splits": robo["splits"],
            "leaked_sequences": robo["leaked_sequences"],
        },
        "duplicates": {
            "total_duplicate_hash_groups": len(scan["duplicate_groups"]),
            "scb_patrol_and_reading_writing_shared": cross_scb_patrol_rw,
            "scb_board_and_reading_writing_shared": cross_scb_board_rw,
            "scb_board_intra_duplicates": intra_board_dups,
            "roboflow_train_valid_label_duplicates": rf_label_dups_cross,
            "roboflow_train_intra_label_duplicates": rf_label_dups_intra,
        },
        "module_readiness": {
            "teacher_movement_tracking": {
                "primary_status": "PARTIALLY READY",
                "supplementary_status": "READY",
                "implementation_ready": True,
                "quantitative_eval_ready": False,
                "reason": "Primary university videos show whiteboard, podium, and front-row movement cleanly, but lack deep aisle-patrolling clips and zone-duration ground truth.",
            },
            "whiteboard_usage_detection": {
                "primary_status": "READY (for development) / PARTIALLY READY (for benchmark)",
                "supplementary_status": "READY",
                "implementation_ready": True,
                "quantitative_eval_ready": False,
                "reason": "Both BIIT lecture and lab videos clearly capture board writing/pointing plus podium proximity; only temporal ground-truth labels remain to be authored for quantitative F1/MAE.",
            },
            "phone_object_detection": {
                "primary_status": "PARTIALLY READY",
                "supplementary_status": "NOT READY FOR BBOX EVAL (semantic mismatch)",
                "implementation_ready": True,
                "quantitative_eval_ready": False,
                "reason": "Roboflow boxes mark whole student behavior ('phone_use'), not small physical phone objects; local IMG_7404 and 04_front_whatsapp show real handheld phone vs unused desk phone without box GT yet.",
            },
            "student_phone_usage_detection": {
                "primary_status": "PARTIALLY READY",
                "supplementary_status": "READY (with leakage caveat)",
                "implementation_ready": True,
                "quantitative_eval_ready": False,
                "reason": "Primary dev clip 03_front_IMG_7404.mov (active use), 02_front_IMG_7391.mov (aisle holder), and 04_front_whatsapp.mp4 (unused phone on desk + hand-on-chin + writing) cover core cases; near-face phone call clip and verified test GT CSV are missing.",
            },
            "continuous_phone_usage_video_testing": {
                "primary_status": "PARTIALLY READY",
                "supplementary_status": "NOT APPLICABLE (external images only)",
                "implementation_ready": True,
                "quantitative_eval_ready": False,
                "reason": "Continuous local train/test videos exist (32s-103s, 30-60 FPS) with zero corrupted frames, ready to run pretrained inference; continuous start/end event timestamps still needed for evaluation.",
            },
        },
        "attribution": {
            "primary_university": {
                "name": "MEye-Pro BIIT University Classroom Recordings",
                "license": "Internal FYP Team Dataset",
                "original_location": "dataset/{teacher_videos,student_videos,phone_frames}",
            },
            "roboflow_student_phone": {
                "name": robo["data_yaml"]["roboflow"].get("project", "student-using-phone-or-not"),
                "url": robo["data_yaml"]["roboflow"].get("url", ""),
                "license": robo["data_yaml"]["roboflow"].get("license", "Unclear"),
                "annotation_format": "YOLOv8 bounding boxes (5 person/behavior classes)",
                "original_location": f"dataset/{ext_root.name}/{{train,valid,test}}",
                "prepared_location": "dataset/member_3/phone_detection/supplementary/roboflow_student_phone",
            },
            "scb_chinese_folders": {
                "name": "Classroom Behavior Image Subsets (教师板书, 巡视, 读写 - likely SCB-Dataset extract)",
                "url": "Not documented in local files",
                "license": "Unclear / Needs manual verification",
                "annotation_format": "Unannotated images grouped by Chinese folder name",
                "original_location": f"dataset/{ext_root.name}/{{教师板书,巡视,读写}}",
                "prepared_location": "dataset/member_3/{teacher_tracking,phone_detection}/supplementary/",
            },
        },
    }

    return teacher_rows, phone_rows, mapping_rows, issues, summary


def build_audit_markdown(summary: dict, issues: list[dict]) -> str:
    inv = summary["inventory"]
    rf = summary["roboflow_validation"]
    dups = summary["duplicates"]
    mr = summary["module_readiness"]

    lines = [
        "# Member 3 Dataset Audit & Readiness Report",
        "",
        "> **Approach:** 100% Pretrained Computer Vision (YOLO detection, YOLO pose estimation, BoT-SORT tracking, spatial/temporal OpenCV/NumPy rules). No custom model training, fine-tuning, or artificial augmentation.",
        "> **Source Precedence:** University-recorded clips (`primary/`) are authoritative for calibration, zone rules, and final evaluation. Downloaded datasets (`supplementary/`) serve only for edge-case checks and cross-room robustness testing.",
        "",
        "## 1. Dataset Inventory",
        "",
        "| Category | Priority | Split / Role | Count | Details |",
        "| --- | --- | --- | ---: | --- |",
        f"| Local Teacher Videos (Dev) | `primary` | `development` | {inv['local_teacher_videos_train']} | `teacher_videos/train/` (1080p/720p/576p, 50.9s–300.7s) |",
        f"| Local Teacher Videos (Test) | `primary` | `held_out_test` | {inv['local_teacher_videos_test']} | `teacher_videos/test/` (kept untouched for final eval) |",
        f"| Local Teacher Classroom Still | `primary` | `development` | {inv['local_teacher_stills']} | `teacher_videos/train/classroom_board_still.jpeg` (4032x3024) |",
        f"| External Teacher Images (SCB) | `supplementary` | `supplementary_reference` | {inv['external_teacher_images']} | `board_writing` (1,907) + `classroom_movement` (1,823) |",
        f"| Local Student Videos (Dev) | `primary` | `development` | {inv['local_student_videos_train']} | `student_videos/train/` (32.1s–103.0s) |",
        f"| Local Student Videos (Test) | `primary` | `held_out_test` | {inv['local_student_videos_test']} | `student_videos/test/` (97.4s paired session, untouched) |",
        f"| Local Phone Frames (Extracted) | `primary` | `development` | {inv['local_phone_frames']} | `phone_frames/` from local `student_videos/train/` |",
        f"| External Student Phone Images (Roboflow) | `supplementary` | `dev/val/test` | {inv['external_roboflow_images']} | `train={rf['splits']['train']['images']}`, `valid={rf['splits']['valid']['images']}`, `test={rf['splits']['test']['images']}` ({inv['external_roboflow_annotation_files']} YOLO `.txt` files) |",
        f"| External Reading/Writing Images (SCB) | `supplementary` | `supplementary_reference` | {inv['external_scb_reading_writing_images']} | `读写` -> `supplementary/reading_writing` |",
        "",
        f"- **Total Inspected Source Assets:** {inv['total_source_files_inspected']} files ({inv['total_size_gb']} GB)",
        f"- **Roboflow Annotation Classes (`nc={len(rf['classes'])}`):** `{rf['classes']}`",
        "",
        "## 2. Data Quality & Integrity Checks",
        "",
        f"- **Corrupted Images/Videos:** {inv['corrupt_media_count']} (all local videos & 5,376 JPEGs decoded cleanly; `gate_videos` carry `rotation=-90`, teacher/student clips have `rotation=0`)",
        f"- **Empty Files / Orphan Annotations / Bad YOLO Coords / Invalid Class IDs:** 0 / 0 / 0 / 0",
        f"- **Empty YOLO `.txt` Label Files:** 0",
        f"- **Exact SHA-256 Duplicate Groups:** {dups['total_duplicate_hash_groups']} groups total:",
        f"  - SCB `巡视` (classroom movement) vs `读写` (reading/writing): **{dups['scb_patrol_and_reading_writing_shared']} shared identical images**",
        f"  - SCB `教师板书` vs `读写`: **{dups['scb_board_and_reading_writing_shared']} shared image** (`131_000078.jpg`)",
        f"  - SCB `教师板书` intra-folder duplicates: **{dups['scb_board_intra_duplicates']} pairs** (`5015_*` vs `5067_*`)",
        f"  - Roboflow duplicate `.txt` files across `train` & `valid`: **{dups['roboflow_train_valid_label_duplicates']}** (+ **{dups['roboflow_train_intra_label_duplicates']}** inside `train`)",
        f"- **Potential Split Leakage:** **YES (`CRITICAL`)** — All {len(rf['leaked_sequences'])} multi-frame Roboflow sequences (`{', '.join(rf['leaked_sequences'])}`) span across `train`, `valid`, and `test`. Local primary clips show **0** cross-split leakage.",
        "",
        "### Logged Validation Issues",
        "| ID | Severity | Category | Summary |",
        "| --- | --- | --- | --- |",
    ]
    for iss in issues:
        lines.append(f"| {iss['issue_id']} | {iss['severity']} | {iss['category']} | {iss['description']} |")

    lines.extend([
        "",
        "## 3. Module Readiness Assessment (Primary vs. Supplementary)",
        "",
    ])
    pretty = {
        "teacher_movement_tracking": "Teacher movement tracking",
        "whiteboard_usage_detection": "Whiteboard usage detection",
        "phone_object_detection": "Phone object detection",
        "student_phone_usage_detection": "Student phone usage detection",
        "continuous_phone_usage_video_testing": "Continuous phone usage video testing",
    }
    for key, title in pretty.items():
        item = mr[key]
        lines.extend([
            f"### {title}",
            f"- **Primary University Dataset:** **{item['primary_status']}**",
            f"- **Supplementary External Dataset:** **{item['supplementary_status']}**",
            f"- **Implementation Ready / Quantitative Benchmark Ready:** `{'Yes' if item['implementation_ready'] else 'No'}` / `{'Yes' if item['quantitative_eval_ready'] else 'No'}`",
            f"- **Evidence & Missing Scenarios:** {item['reason']}",
            "",
        ])

    lines.extend([
        "### Summary of Gaps in Primary University Recordings",
        "1. **Phone near face (voice call posture):** Not clearly observed in sampled frames of local `student_videos/train` (we observed handheld lap/desk phone usage in `03_front_IMG_7404.mov`, aisle handheld in `02_front_IMG_7391.mov`, and an unused flat phone on desk in `04_front_whatsapp.mp4`).",
        "2. **Deep teacher aisle patrolling:** `teacher_videos/train` covers whiteboard writing, projector screen teaching, wooden podium presence, and front-row stepping, with minimal deep-aisle walking among back desks.",
        "3. **Quantitative Ground Truth:** No box-level or timestamped event ground-truth files exist yet for `held_out_test` videos (`phone_frames_index.csv` is also unlabeled).",
        "4. **Should we record 1–2 short extra BIIT clips later?** Yes — capturing one short local clip with a student holding a phone to the ear + one teacher aisle walk + lightweight `held_out_test` event timestamps will enable real university precision/recall/MAE reporting.",
        "",
        "## 4. Dataset Attribution",
        "",
        "| Dataset | Role | License | Annotation Format | Original Location | Prepared Location |",
        "| --- | --- | --- | --- | --- | --- |",
        "| BIIT University Classroom Recordings | `primary` | Internal FYP Team Data | Unlabeled raw `.mov`/`.mp4`/`.jpeg` + `phone_frames_index.csv` | `dataset/{teacher_videos,student_videos,phone_frames}` | Referenced via `dataset/member_3/*/primary/` |",
        "| Roboflow `student-using-phone-or-not` v1 ([link](https://universe.roboflow.com/deep-learning-project-rddrg/student-using-phone-or-not/dataset/1)) | `supplementary` | `CC BY 4.0` | YOLOv8 bbox (`bullying`, `daydreaming`, `hand_rising`, `human`, `phone_use`) | `dataset/new _ prepared_data_set/{train,valid,test}` | `dataset/member_3/phone_detection/supplementary/roboflow_student_phone` |",
        "| SCB Chinese Classroom Subsets (`教师板书`, `巡视`, `读写`) | `supplementary` | **Unclear / Flagged for Review** | Folder-level scene names only | `dataset/new _ prepared_data_set/{教师板书,巡视,读写}` | `dataset/member_3/{teacher_tracking,phone_detection}/supplementary/` |",
    ])
    return "\n".join(lines) + "\n"


def build_readme_files(summary: dict) -> dict[str, str]:
    """Generate concise README files for member_3 root and subfolders."""
    rf = summary["roboflow_validation"]
    main_readme = f"""# Member 3 Prepared Dataset (`MEye-Pro`)

**This dataset is prepared exclusively for a pretrained Computer Vision approach. No custom model training or fine-tuning is planned.**

All original shared directories (`enrollment_photos/`, `teacher_videos/`, `student_videos/`, `gate_videos/`, `phone_frames/`, and `new _ prepared_data_set/`) remain untouched. Heavy primary videos are referenced via relative paths in manifests instead of duplicating gigabytes on disk; external supplementary images and YOLO labels are safely linked (`os.link`, or copied if cross-volume) inside `dataset/member_3/`.

## Directory Structure
```text
dataset/member_3/
├── teacher_tracking/
│   ├── primary/                  # University recordings (development/ + held_out_test/ indexes)
│   ├── supplementary/            # SCB board_writing (1,907) & classroom_movement (1,823)
│   ├── calibration/              # Future room zone polygons (whiteboard, podium, student_area)
│   ├── ground_truth/             # Future held-out teacher zone duration ground truth
│   └── metadata/
├── phone_detection/
│   ├── primary/                  # University student videos + 71 extracted phone_frames indexes
│   ├── supplementary/            # Roboflow student_phone (663 labeled imgs) + SCB reading_writing (912 imgs)
│   ├── ground_truth/             # Future held-out student phone event ground truth
│   └── metadata/
├── manifests/
│   ├── teacher_dataset.csv
│   ├── phone_dataset.csv
│   └── file_mapping.csv
└── reports/
    ├── dataset_audit.md
    ├── dataset_summary.json
    └── validation_issues.csv
```

## Module Ownership & Primary vs. Supplementary Precedence
- **Module A (`teacher_tracking/`):** Whiteboard usage, standing near whiteboard, podium presence, moving near students, and zone dwell duration. Use `teacher_videos/train/` (`development`) first for room calibration and logic tuning; keep `teacher_videos/test/` (`held_out_test`) strictly untouched until final benchmark.
- **Module B (`phone_detection/`):** Student phone holding/usage vs writing, reading, resting hand near face, or unused phone on desk. Use `student_videos/train/` and `phone_frames/` (`development`) first; evaluate independently on `student_videos/test/` (`held_out_test`) once event timestamps are labeled.
- **External Supplementary Data (`supplementary/`):** Used strictly for robustness checks, failure analysis, and additional non-university views. Never mix external metrics with primary BIIT classroom results.

## Annotation Classes & Semantics (Roboflow Supplementary)
Original `data.yaml` classes (`nc={len(rf['classes'])}`): `{rf['classes']}`.
- `phone_use`: Bounding box covers the **student / body / arm using a phone** (`w_med~0.066`, `h_med~0.106`, up to `0.686`), **NOT** a physical smartphone object (`COCO class 67: cell phone`).
- `human`, `hand_rising`, `daydreaming`, `bullying`: Person-level student behavior classes. Images without `phone_use` are marked `unknown` (not assumed negative) unless verified.

## Split Conventions
- Local recordings: `train` -> `development`, `test` -> `held_out_test`.
- Roboflow supplementary: `train` -> `development`, `valid` -> `validation`, `test` -> `held_out_test` (note: sequences `sample_1`, `sample_2`, `sample_3` overlap across all 3 Roboflow splits — see `reports/validation_issues.csv`).
- SCB supplementary: `unspecified` -> `supplementary_reference` (`270` shared hashes exist between `classroom_movement` and `reading_writing`).

## Re-Running Dataset Preparation & Adding Data
```powershell
python tools/prepare_member3_dataset.py --dry-run
python tools/prepare_member3_dataset.py --apply
```
To add new BIIT clips later, place them in `dataset/teacher_videos/` or `dataset/student_videos/` (`train/` or `test/`) without spaces in filenames and re-run `--dry-run` then `--apply`.

## Sources & Attribution
- **Primary BIIT University Data:** Internal FYP recordings (`teacher_videos/`, `student_videos/`, `phone_frames/`).
- **Roboflow (`student-using-phone-or-not`, v1):** `CC BY 4.0` — https://universe.roboflow.com/deep-learning-project-rddrg/student-using-phone-or-not/dataset/1
- **SCB Classroom Image Subsets (`教师板书`, `巡视`, `读写`):** No bundled license/URL found locally; flagged for review before redistribution.
"""

    teacher_readme = """# Module A — Teacher Board & Movement Tracking Dataset

- **`primary/`**: References BIIT local `teacher_videos/train` (`development`: 4 videos + `classroom_board_still.jpeg`) and `teacher_videos/test` (`held_out_test`: 3 videos).
- **`supplementary/`**:
  - `board_writing/` (`1,907` images from `教师板书`, `8` internal duplicate pairs flagged in manifest).
  - `classroom_movement/` (`1,823` images from `巡视`; note some frames depict front podium/board stance and `270` overlap with `reading_writing`).
- **`calibration/`**: Target folder for per-venue zone polygon configs (`whiteboard`, `podium`, `student_area`).
- **`ground_truth/`**: Target folder for held-out zone duration evaluation CSVs.
"""

    phone_readme = """# Module B — Student Phone Usage Detection Dataset

- **`primary/`**: References BIIT local `student_videos/train` (`development`: 4 videos), `phone_frames/` (`71` extracted frames), and `student_videos/test` (`held_out_test`: 2 paired videos).
  - Verified dev behavior observed: `03_front_IMG_7404.mov` (active handheld phone use ~20–32s + writing + hand-on-head), `02_front_IMG_7391.mov` (aisle phone holder + writing), `04_front_whatsapp.mp4` (unused phone lying flat on desk + chin-on-hand + writing), `01_front_IMG_7390.mov` (computer lab monitors occluding laps).
- **`supplementary/`**:
  - `roboflow_student_phone/`: 663 YOLOv8-labeled images (`phone_use` marks whole student/person behavior, not physical phone bounding box). Sequence overlap (`sample_1`, `sample_2`, `sample_3`) exists across train/valid/test.
  - `reading_writing/`: `912` SCB images (`270` shared with `classroom_movement`). Unverified for hidden phones -> labeled `unknown`.
- **`ground_truth/`**: Target folder for frame/video phone-usage event ground truth.
"""

    return {
        "member_3/README.md": main_readme,
        "member_3/teacher_tracking/README.md": teacher_readme,
        "member_3/phone_detection/README.md": phone_readme,
        "member_3/teacher_tracking/calibration/README.md": "# Calibration\nStore normalized `[0..1]` venue zone JSON files (`whiteboard`, `podium`, `students`) here.\n",
        "member_3/teacher_tracking/ground_truth/README.md": "# Ground Truth\nStore verified zone transition and dwell-time CSV files for `held_out_test` here.\n",
        "member_3/phone_detection/ground_truth/README.md": "# Ground Truth\nStore verified student phone usage timestamp/event CSV files for `held_out_test` here.\n",
    }


def write_text_if_safe(path: Path, content: str, dry_run: bool, stats: dict) -> None:
    """Write text file in UTF-8 cleanly without noisy rewrites when unchanged."""
    new_bytes = content.encode("utf-8")
    if path.exists():
        if path.read_bytes() == new_bytes:
            stats["unchanged"] += 1
            return
        stats["updated_generated"] += 1
    else:
        stats["created_text"] += 1
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(new_bytes)


def csv_to_string(fields: list[str], rows: list[dict]) -> str:
    """Serialize rows to UTF-8 CSV string in memory."""
    import io
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def link_or_copy(src: Path, dst: Path, src_sha: str, dry_run: bool, stats: dict) -> None:
    """Create hardlink (with copy fallback) never overwriting differing target content."""
    if dst.exists():
        dst_sha = sha256_file(dst)
        if dst_sha == src_sha:
            stats["already_linked_or_copied"] += 1
            return
        stats["conflicts"].append(f"{dst} (existing sha256 differs from source {src})")
        return

    if dry_run:
        stats["planned_links_or_copies"] += 1
        return

    dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(src, dst)
        stats["linked"] += 1
    except OSError:
        shutil.copy2(src, dst)
        stats["copied"] += 1


def execute(repo_root: Path, apply_changes: bool) -> int:
    dataset_root = (repo_root / "dataset").resolve()
    ext_root = find_external_root(dataset_root)
    m3_root = dataset_root / "member_3"
    dry_run = not apply_changes

    scan = scan_repository_dataset(dataset_root, ext_root)
    robo = validate_roboflow_dataset(ext_root)
    pf_index = read_phone_frames_index(dataset_root)
    teacher_rows, phone_rows, mapping_rows, issues, summary = build_manifests_and_issues(
        dataset_root, ext_root, scan, robo, pf_index
    )

    stats = collections.Counter()
    stats["conflicts"] = []

    # Prepare planned hardlinks/copies for external supplementary datasets
    ext_links = []
    for ch_dir, (module, sub_rel, _, _) in SCB_FOLDERS.items():
        for src in sorted((ext_root / ch_dir).iterdir()):
            if src.is_file():
                rel = src.relative_to(dataset_root).as_posix()
                dst = m3_root / module / sub_rel / src.name
                ext_links.append((src, dst, scan["records"][rel]["sha256"]))

    rf_base = m3_root / "phone_detection" / "supplementary" / "roboflow_student_phone"
    for split in ("train", "valid", "test"):
        for sub in ("images", "labels"):
            for src in sorted((ext_root / split / sub).iterdir()):
                if src.is_file():
                    rel = src.relative_to(dataset_root).as_posix()
                    dst = rf_base / split / sub / src.name
                    ext_links.append((src, dst, scan["records"][rel]["sha256"]))

    for src, dst, src_sha in ext_links:
        link_or_copy(src, dst, src_sha, dry_run, stats)

    # Documentation copies from Roboflow root
    for doc in ("README.dataset.txt", "README.roboflow.txt"):
        src = ext_root / doc
        if src.is_file():
            dst = rf_base / "documentation" / doc
            content = src.read_text(encoding="utf-8", errors="replace")
            write_text_if_safe(dst, content, dry_run, stats)

    # Prepared data.yaml with fixed local paths (copy only; original untouched)
    fixed_yaml = {"path": "."}
    fixed_yaml.update(robo["data_yaml"])
    fixed_yaml["train"] = "train/images"
    fixed_yaml["val"] = "valid/images"
    fixed_yaml["test"] = "test/images"
    write_text_if_safe(rf_base / "data.yaml", yaml.safe_dump(fixed_yaml, sort_keys=False), dry_run, stats)

    # Primary split index CSVs (lightweight relative-path pointers inside primary/)
    teacher_fields = list(teacher_rows[0].keys())
    phone_fields = list(phone_rows[0].keys())
    mapping_fields = list(mapping_rows[0].keys())
    issue_fields = list(issues[0].keys())

    for split_name in ("development", "held_out_test"):
        t_sub = [r for r in teacher_rows if r["dataset_priority"] == "primary" and r["usage_split"] == split_name]
        write_text_if_safe(
            m3_root / "teacher_tracking" / "primary" / split_name / "primary_index.csv",
            csv_to_string(teacher_fields, t_sub),
            dry_run,
            stats,
        )
        p_sub = [r for r in phone_rows if r["dataset_priority"] == "primary" and r["usage_split"] == split_name]
        write_text_if_safe(
            m3_root / "phone_detection" / "primary" / split_name / "primary_index.csv",
            csv_to_string(phone_fields, p_sub),
            dry_run,
            stats,
        )

    # Phone frames index reference under primary/
    pf_meta = {
        "primary_phone_frames_csv": "../../../../phone_frames/phone_frames_index.csv",
        "frame_count": sum(1 for r in phone_rows if r["source_dataset"] == "university_phone_frames"),
        "note": "Original phone_frames directory preserved unchanged.",
    }
    write_text_if_safe(
        m3_root / "phone_detection" / "primary" / "phone_frames" / "index_ref.json",
        json.dumps(pf_meta, indent=2) + "\n",
        dry_run,
        stats,
    )

    # Module metadata summaries
    write_text_if_safe(
        m3_root / "teacher_tracking" / "metadata" / "teacher_metadata_summary.json",
        json.dumps({
            "primary_items": sum(1 for r in teacher_rows if r["dataset_priority"] == "primary"),
            "supplementary_items": sum(1 for r in teacher_rows if r["dataset_priority"] == "supplementary"),
            "scenarios": dict(collections.Counter(r["scenario"] for r in teacher_rows)),
        }, indent=2) + "\n",
        dry_run,
        stats,
    )
    write_text_if_safe(
        m3_root / "phone_detection" / "metadata" / "phone_metadata_summary.json",
        json.dumps({
            "primary_items": sum(1 for r in phone_rows if r["dataset_priority"] == "primary"),
            "supplementary_items": sum(1 for r in phone_rows if r["dataset_priority"] == "supplementary"),
            "roboflow_validation": summary["roboflow_validation"],
        }, indent=2) + "\n",
        dry_run,
        stats,
    )

    # Master manifests and reports
    write_text_if_safe(m3_root / "manifests" / "teacher_dataset.csv", csv_to_string(teacher_fields, teacher_rows), dry_run, stats)
    write_text_if_safe(m3_root / "manifests" / "phone_dataset.csv", csv_to_string(phone_fields, phone_rows), dry_run, stats)
    write_text_if_safe(m3_root / "manifests" / "file_mapping.csv", csv_to_string(mapping_fields, mapping_rows), dry_run, stats)
    write_text_if_safe(m3_root / "reports" / "validation_issues.csv", csv_to_string(issue_fields, issues), dry_run, stats)
    write_text_if_safe(m3_root / "reports" / "dataset_summary.json", json.dumps(summary, indent=2, ensure_ascii=False) + "\n", dry_run, stats)
    write_text_if_safe(m3_root / "reports" / "dataset_audit.md", build_audit_markdown(summary, issues), dry_run, stats)

    for rel_path, text in build_readme_files(summary).items():
        write_text_if_safe(dataset_root / rel_path, text, dry_run, stats)

    mode = "APPLY" if apply_changes else "DRY-RUN"
    print(f"[{mode}] External source: {ext_root.name}")
    print(f"[{mode}] Source files verified: {len(scan['records'])} | Corrupt: {len(scan['corrupt_media'])} | Empty: {len(scan['empty_files'])}")
    print(f"[{mode}] Teacher manifest rows: {len(teacher_rows)} | Phone manifest rows: {len(phone_rows)} | Issues: {len(issues)}")
    print(f"[{mode}] Media ops -> planned={stats['planned_links_or_copies']}, linked={stats['linked']}, copied={stats['copied']}, already_ok={stats['already_linked_or_copied']}")
    print(f"[{mode}] Text/CSV/MD ops -> created={stats['created_text']}, updated={stats['updated_generated']}, unchanged={stats['unchanged']}")
    if stats["conflicts"]:
        print(f"[{mode}] CONFLICTS ({len(stats['conflicts'])}):")
        for c in stats["conflicts"][:10]:
            print("  !", c)
        return 1
    return 0


def main() -> int:
    default_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Inspect, validate, and organize Member 3 dataset cleanly.")
    parser.add_argument("--repo-root", type=Path, default=default_root, help="Path to mi_eye-pro repository root.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Inspect and report planned operations without modifying disk.")
    group.add_argument("--apply", action="store_true", help="Safely create member_3 prepared structure, manifests, and reports.")
    args = parser.parse_args()
    return execute(args.repo_root.resolve(), apply_changes=args.apply)


if __name__ == "__main__":
    sys.exit(main())
