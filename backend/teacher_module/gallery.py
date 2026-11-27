import argparse
import hashlib
import json
import re
from pathlib import Path

import cv2
import face_recognition
import numpy as np

if __package__:
    from . import config
else:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from backend.teacher_module import config

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
_MODELS = {}


def load_face_models():
    if _MODELS:
        return _MODELS["detector"], _MODELS["embedder"]
    config.ensure_cuda_dlls()
    import tensorflow as tf
    from keras_facenet import FaceNet
    from mtcnn import MTCNN

    for gpu in tf.config.list_physical_devices("GPU"):
        tf.config.experimental.set_memory_growth(gpu, True)
    tf.keras.utils.disable_interactive_logging()
    _MODELS["detector"] = MTCNN()
    _MODELS["embedder"] = FaceNet()
    return _MODELS["detector"], _MODELS["embedder"]


def sha256_file(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def l2_normalize(vec):
    norm = np.linalg.norm(vec, axis=-1, keepdims=True)
    return vec / np.maximum(norm, 1e-12)


def align_face_crop(rgb, box, keypoints):
    x1, y1, x2, y2 = box
    le, re = (keypoints or {}).get("left_eye"), (keypoints or {}).get("right_eye")
    if le and re:
        dx, dy = re[0] - le[0], re[1] - le[1]
        angle = float(np.degrees(np.arctan2(dy, dx)))
        if abs(angle) <= 45.0:
            cx, cy = 0.5 * (x1 + x2), 0.5 * (y1 + y2)
            rot_m = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
            rotated = cv2.warpAffine(rgb, rot_m, (rgb.shape[1], rgb.shape[0]), flags=cv2.INTER_LINEAR)
            crop = rotated[max(0, y1):min(rgb.shape[0], y2), max(0, x1):min(rgb.shape[1], x2)]
            if min(crop.shape[:2]) >= 16:
                return crop
    return rgb[y1:y2, x1:x2]


def detect_faces_rgb(rgb, detector, max_dim=1280, min_conf=config.FACE_DET_CONF):
    h, w = rgb.shape[:2]
    scale = min(1.0, max_dim / max(h, w)) if max_dim else 1.0
    small = cv2.resize(rgb, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1.0 else rgb
    found = []
    for det in detector.detect_faces(small):
        if det["confidence"] < min_conf:
            continue
        x, y, bw, bh = det["box"]
        x1 = max(0, round(x / scale))
        y1 = max(0, round(y / scale))
        x2 = min(w, round((x + bw) / scale))
        y2 = min(h, round((y + bh) / scale))
        if min(x2 - x1, y2 - y1) >= config.MIN_FACE_PX:
            kp = {k: (round(v[0] / scale), round(v[1] / scale)) for k, v in det.get("keypoints", {}).items()}
            found.append(((x1, y1, x2, y2), float(det["confidence"]), kp))
    return found


def embed_face_crops(crops_rgb, embedder):
    if not crops_rgb:
        return np.zeros((0, 512), dtype=np.float32)
    resized = [cv2.resize(c, (160, 160), interpolation=cv2.INTER_AREA) for c in crops_rgb]
    embs = embedder.embeddings(np.asarray(resized))
    return l2_normalize(embs).astype(np.float32)


def dlib_encode_box(rgb, box):
    x1, y1, x2, y2 = box
    encs = face_recognition.face_encodings(rgb, [(y1, x2, y2, x1)], num_jitters=1, model="small")
    return encs[0].astype(np.float32) if encs else None


def enroll_teacher(teacher_id, photo_dir, gallery_path=config.GALLERY_PATH):
    photo_dir = Path(photo_dir)
    gallery_path = Path(gallery_path)
    detector, embedder = load_face_models()

    paths = sorted(p for p in photo_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS)
    if not paths:
        raise ValueError(f"No enrollment photos found in {photo_dir}")

    safe_id = re.sub(r"[^A-Za-z0-9._-]+", "_", teacher_id)
    preview_dir = gallery_path.parent / "enrollment_previews" / safe_id
    preview_dir.mkdir(parents=True, exist_ok=True)

    seen_hashes = {}
    unique_embs = []
    unique_dlib = []
    used_files = []
    skipped_duplicates = []

    for path in paths:
        digest = sha256_file(path)
        if digest in seen_hashes:
            skipped_duplicates.append({"file": path.name, "duplicate_of": seen_hashes[digest]})
            print(f"[SKIP DUPLICATE] {path.name} == {seen_hashes[digest]}")
            continue
        seen_hashes[digest] = path.name

        bgr = cv2.imread(str(path))
        if bgr is None:
            raise IOError(f"Failed to read enrollment photo: {path}")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        faces = detect_faces_rgb(rgb, detector, max_dim=1280)
        if not faces:
            print(f"[WARN] No face detected in {path.name}")
            continue

        best_box, best_conf, best_kp = max(
            faces, key=lambda item: (item[0][2] - item[0][0]) * (item[0][3] - item[0][1])
        )
        if len(faces) > 1:
            vis = bgr.copy()
            for box, _, _ in faces:
                color = (0, 220, 0) if box == best_box else (0, 165, 255)
                cv2.rectangle(vis, (box[0], box[1]), (box[2], box[3]), color, 3)
            cv2.imwrite(str(preview_dir / f"{path.stem}_preview.jpg"), vis)

        aligned = align_face_crop(rgb, best_box, best_kp)
        emb = embed_face_crops([aligned], embedder)[0]
        d_enc = dlib_encode_box(rgb, best_box)
        unique_embs.append(emb)
        if d_enc is not None:
            unique_dlib.append(d_enc)
        used_files.append({
            "file": path.name,
            "sha256": digest,
            "det_conf": round(best_conf, 4),
            "faces_in_photo": len(faces),
        })

    if not unique_embs:
        raise RuntimeError(f"Zero valid face embeddings extracted for {teacher_id}")

    templates = np.stack(unique_embs).astype(np.float32)
    mean_emb = l2_normalize(templates.mean(axis=0, keepdims=True))[0].astype(np.float32)
    dlib_templates = np.stack(unique_dlib).astype(np.float32) if unique_dlib else np.zeros((0, 128), dtype=np.float32)

    gallery = load_gallery(gallery_path) if gallery_path.exists() else {"teachers": {}}
    gallery["teachers"][teacher_id] = {
        "templates": templates,
        "mean": mean_emb,
        "dlib_templates": dlib_templates,
    }

    gallery_path.parent.mkdir(parents=True, exist_ok=True)
    arrays = {}
    meta = {"teachers": {}}
    for tid, data in gallery["teachers"].items():
        key = re.sub(r"[^A-Za-z0-9._-]+", "_", tid)
        arrays[f"{key}__templates"] = data["templates"]
        arrays[f"{key}__mean"] = data["mean"]
        arrays[f"{key}__dlib"] = data["dlib_templates"]
        meta["teachers"][tid] = {"key": key, "num_templates": int(data["templates"].shape[0])}

    meta_path = gallery_path.with_name(gallery_path.stem + "_meta.json")
    if meta_path.exists():
        old_meta = json.loads(meta_path.read_text(encoding="utf-8"))
        for tid, info in old_meta.get("teachers", {}).items():
            if tid in meta["teachers"] and tid != teacher_id:
                meta["teachers"][tid].update(info)

    meta["teachers"][teacher_id].update({
        "photo_dir": str(photo_dir),
        "used_files": used_files,
        "skipped_duplicates": skipped_duplicates,
    })

    np.savez(gallery_path, **arrays)
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(
        f"Enrolled {teacher_id}: {len(used_files)} unique templates, "
        f"{len(skipped_duplicates)} duplicates skipped -> {gallery_path}"
    )
    return meta["teachers"][teacher_id]


def load_gallery(gallery_path=config.GALLERY_PATH):
    gallery_path = Path(gallery_path)
    meta_path = gallery_path.with_name(gallery_path.stem + "_meta.json")
    if not gallery_path.exists() or not meta_path.exists():
        raise FileNotFoundError(f"Teacher gallery not found at {gallery_path}")

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    npz = np.load(gallery_path)
    teachers = {}
    for tid, info in meta.get("teachers", {}).items():
        key = info["key"]
        teachers[tid] = {
            "templates": npz[f"{key}__templates"],
            "mean": npz[f"{key}__mean"],
            "dlib_templates": npz[f"{key}__dlib"] if f"{key}__dlib" in npz else np.zeros((0, 128), dtype=np.float32),
        }
    return {"teachers": teachers, "meta": meta}


def match_embedding(emb, gallery, teacher_id=None, threshold=config.FACE_SIM_THRESHOLD, dlib_enc=None):
    teachers = gallery.get("teachers", {})
    if not teachers:
        return None, 0.0, False

    best_id = None
    best_score = -1.0
    for tid, data in teachers.items():
        template_sim = float(np.max(data["templates"] @ emb))
        mean_sim = float(data["mean"] @ emb)
        score = max(template_sim, mean_sim)
        if score > best_score:
            best_score = score
            best_id = tid

    matched = best_id is not None and best_score >= threshold
    if matched and dlib_enc is not None:
        d_bank = teachers[best_id].get("dlib_templates")
        if d_bank is not None and len(d_bank) > 0:
            min_dist = float(np.min(np.linalg.norm(d_bank - dlib_enc, axis=1)))
            if min_dist > config.DLIB_DIST_THRESHOLD:
                matched = False

    matched_scheduled = bool(matched and (teacher_id is None or best_id == teacher_id))
    return best_id, best_score, matched_scheduled


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enroll teacher photos into multi-template gallery.")
    parser.add_argument("--teacher-id", default="teacher:Naseer")
    parser.add_argument("--photos", type=Path, default=config.RAW_DATA_DIR / "teacher" / "Naseer")
    parser.add_argument("--gallery", type=Path, default=config.GALLERY_PATH)
    args = parser.parse_args()
    enroll_teacher(args.teacher_id, args.photos, args.gallery)
