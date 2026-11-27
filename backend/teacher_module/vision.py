import time
import urllib.request
from pathlib import Path

import cv2
import numpy as np

if __package__:
    from . import config, gallery as gallery_mod
else:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from backend.teacher_module import config, gallery as gallery_mod

YOLO_CFG_URL = "https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4-tiny.cfg"
YOLO_WTS_URL = "https://github.com/AlexeyAB/darknet/releases/download/darknet_yolo_v4_pre/yolov4-tiny.weights"
_DETECTOR = None


def load_person_detector():
    global _DETECTOR
    if _DETECTOR is not None:
        return _DETECTOR
    config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    cfg = config.MODELS_DIR / "yolov4-tiny.cfg"
    wts = config.MODELS_DIR / "yolov4-tiny.weights"
    if not cfg.exists():
        urllib.request.urlretrieve(YOLO_CFG_URL, cfg)
    if not wts.exists():
        urllib.request.urlretrieve(YOLO_WTS_URL, wts)
    net = cv2.dnn.readNetFromDarknet(str(cfg), str(wts))
    model = cv2.dnn_DetectionModel(net)
    model.setInputParams(size=(416, 416), scale=1.0 / 255.0, swapRB=True)
    _DETECTOR = model
    return model


def open_video(path):
    cap = cv2.VideoCapture(str(path), cv2.CAP_FFMPEG)
    if not cap.isOpened() or not cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1):
        cap.release()
        raise ValueError(f"Could not open video with automatic rotation: {path}")
    return cap


def iter_sampled_frames(path, sample_fps):
    interval = 1.0 / sample_fps
    cap = open_video(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0
    est_duration = frame_count / fps if frame_count > 0 else 0.0
    try:
        target = 0.0
        last_sec = 0.0
        while cap.grab():
            sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            last_sec = max(last_sec, sec)
            if sec + 1e-6 < target:
                continue
            ok, frame = cap.retrieve()
            if not ok:
                raise IOError(f"Failed decoding frame at {sec:.2f}s in {path}")
            yield sec, frame, max(est_duration, last_sec)
            target += interval
    finally:
        cap.release()


def box_iou(a, b):
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    area_a = max(1, (a[2] - a[0]) * (a[3] - a[1]))
    area_b = max(1, (b[2] - b[0]) * (b[3] - b[1]))
    return inter / (area_a + area_b - inter)


def detect_persons_in_roi(frame, model, roi):
    h, w = frame.shape[:2]
    rx1, ry1, rx2, ry2 = roi[0] * w, roi[1] * h, roi[2] * w, roi[3] * h
    classes, confs, boxes = model.detect(
        frame,
        confThreshold=config.PERSON_CONF_THRESHOLD,
        nmsThreshold=config.PERSON_NMS_THRESHOLD,
    )
    persons = []
    if len(classes) == 0:
        return persons
    for cid, conf, (bx, by, bw, bh) in zip(classes, confs, boxes):
        if int(cid) != 0:
            continue
        x1, y1 = max(0, int(bx)), max(0, int(by))
        x2, y2 = min(w, int(bx + bw)), min(h, int(by + bh))
        if x2 - x1 < 20 or y2 - y1 < 30:
            continue
        cx, torso_y = 0.5 * (x1 + x2), y1 + 0.35 * (y2 - y1)
        if rx1 <= cx <= rx2 and ry1 <= torso_y <= ry2:
            persons.append((x1, y1, x2, y2))
    return persons


def update_tracks(tracks, detections, sec, frame_shape, next_id):
    h, w = frame_shape[:2]
    diag = float(np.hypot(w, h))
    used_tracks = set()
    used_dets = set()

    # Pass 1: match VERIFIED_TEACHER tracks first with head-top consistency to avoid student box swaps.
    verified_idx = [ti for ti, tr in enumerate(tracks) if tr["state"] == "VERIFIED_TEACHER"]
    other_idx = [ti for ti, tr in enumerate(tracks) if tr["state"] != "VERIFIED_TEACHER"]
    for group, min_iou in ((verified_idx, 0.20), (other_idx, config.TRACK_IOU_THRESHOLD)):
        pairs = []
        for ti in group:
            ty1 = tracks[ti]["box"][1]
            for di, box in enumerate(detections):
                if di in used_dets:
                    continue
                if abs(ty1 - box[1]) > 0.10 * h:
                    continue
                iou = box_iou(tracks[ti]["box"], box)
                if iou >= min_iou:
                    score = iou - 0.5 * abs(ty1 - box[1]) / h
                    pairs.append((score, ti, di))
        pairs.sort(reverse=True)
        for _, ti, di in pairs:
            if ti in used_tracks or di in used_dets:
                continue
            used_tracks.add(ti)
            used_dets.add(di)
            _refresh_track(tracks[ti], detections[di], sec)

    # Pass 2: short-range head-anchor fallback for fast board motion.
    for group, max_dist_ratio, min_ratio, max_ratio in (
        (verified_idx, 0.12, 0.30, 3.2),
        (other_idx, 0.09, 0.40, 2.5),
    ):
        c_pairs = []
        for ti in group:
            if ti in used_tracks:
                continue
            tx1, ty1, tx2, ty2 = tracks[ti]["box"]
            thx, thy = 0.5 * (tx1 + tx2), ty1 + 0.18 * (ty2 - ty1)
            tarea = max(1, (tx2 - tx1) * (ty2 - ty1))
            for di, box in enumerate(detections):
                if di in used_dets:
                    continue
                dx1, dy1, dx2, dy2 = box
                if abs(ty1 - dy1) > 0.10 * h:
                    continue
                dhx, dhy = 0.5 * (dx1 + dx2), dy1 + 0.18 * (dy2 - dy1)
                darea = max(1, (dx2 - dx1) * (dy2 - dy1))
                dist = float(np.hypot(thx - dhx, thy - dhy))
                if dist <= max_dist_ratio * diag and min_ratio <= (darea / tarea) <= max_ratio:
                    c_pairs.append((dist, ti, di))
        c_pairs.sort()
        for _, ti, di in c_pairs:
            if ti in used_tracks or di in used_dets:
                continue
            used_tracks.add(ti)
            used_dets.add(di)
            _refresh_track(tracks[ti], detections[di], sec)

    # Age unmatched tracks, keep within max_missed
    kept = []
    for ti, tr in enumerate(tracks):
        if ti in used_tracks:
            kept.append(tr)
        else:
            tr["missed"] += 1
            if tr["missed"] <= config.TRACK_MAX_MISSED_FRAMES:
                kept.append(tr)

    # Create new tracks for unmatched detections
    for di, box in enumerate(detections):
        if di not in used_dets:
            kept.append({
                "id": next_id,
                "box": box,
                "missed": 0,
                "state": "UNVERIFIED",
                "match_hits": 0,
                "wrong_hits": 0,
                "matched_id": None,
                "wrong_id": None,
                "best_score": 0.0,
                "last_verify_sec": -1e9,
                "seen_secs": [round(sec, 3)],
            })
            next_id += 1
    return kept, next_id


def _refresh_track(track, box, sec):
    track["box"] = box
    track["missed"] = 0
    track["seen_secs"].append(round(sec, 3))


def upper_body_box(box, frame_shape):
    h, w = frame_shape[:2]
    x1, y1, x2, y2 = box
    pad = 12
    uh = max(60, int(0.65 * (y2 - y1)))
    return max(0, x1 - pad), max(0, y1 - pad), min(w, x2 + pad), min(h, y1 + uh)


def verify_tracks(rgb, tracks, sec, gallery, teacher_id, detector, embedder, confirm_frames, snapshot_mode=False):
    active = [t for t in tracks if t["missed"] == 0]
    verified = [t for t in active if t["state"] == "VERIFIED_TEACHER"]
    if verified:
        to_check = [t for t in verified if sec - t["last_verify_sec"] >= config.REVERIFY_INTERVAL_SEC]
    else:
        retry = 0.0 if snapshot_mode else config.UNVERIFIED_CHECK_INTERVAL_SEC
        to_check = [
            t for t in active
            if t["state"] != "VERIFIED_TEACHER" and sec - t["last_verify_sec"] >= retry
        ]

    if not to_check:
        return [], False

    face_crops = []
    face_boxes_full = []
    crop_owners = []

    if len(to_check) <= 3:
        for tr in to_check:
            ux1, uy1, ux2, uy2 = upper_body_box(tr["box"], rgb.shape)
            crop = rgb[uy1:uy2, ux1:ux2]
            if min(crop.shape[:2]) < 32:
                continue
            for (fx1, fy1, fx2, fy2), _, kp in gallery_mod.detect_faces_rgb(crop, detector, max_dim=0):
                face_crops.append(gallery_mod.align_face_crop(crop, (fx1, fy1, fx2, fy2), kp))
                face_boxes_full.append((ux1 + fx1, uy1 + fy1, ux1 + fx2, uy1 + fy2))
                crop_owners.append(tr)
    else:
        faces = gallery_mod.detect_faces_rgb(rgb, detector, max_dim=1280)
        for (fx1, fy1, fx2, fy2), _, kp in faces:
            fcx, fcy = 0.5 * (fx1 + fx2), 0.5 * (fy1 + fy2)
            best_tr = None
            best_dist = 1e9
            for tr in to_check:
                ux1, uy1, ux2, uy2 = upper_body_box(tr["box"], rgb.shape)
                if ux1 <= fcx <= ux2 and uy1 <= fcy <= uy2:
                    tx1, ty1, tx2, ty2 = tr["box"]
                    head_x, head_y = 0.5 * (tx1 + tx2), ty1 + 0.18 * (ty2 - ty1)
                    d = float(np.hypot(fcx - head_x, fcy - head_y))
                    if d < best_dist:
                        best_dist = d
                        best_tr = tr
            if best_tr is not None:
                face_crops.append(gallery_mod.align_face_crop(rgb, (fx1, fy1, fx2, fy2), kp))
                face_boxes_full.append((fx1, fy1, fx2, fy2))
                crop_owners.append(best_tr)

    if not face_crops:
        for tr in to_check:
            if tr["state"] == "VERIFIED_TEACHER":
                tr["last_verify_sec"] = sec - config.REVERIFY_INTERVAL_SEC + 3.0
            else:
                tr["last_verify_sec"] = sec
        return [], False

    embs = gallery_mod.embed_face_crops(face_crops, embedder)
    per_track = {}
    all_scores = []
    wrong_seen = False

    for tr, fbox, emb in zip(crop_owners, face_boxes_full, embs):
        best_id, score, _ = gallery_mod.match_embedding(emb, gallery, teacher_id)
        all_scores.append(score)
        matched = False
        wrong_confirmed = False
        if score >= config.FACE_SIM_THRESHOLD:
            d_enc = gallery_mod.dlib_encode_box(rgb, fbox)
            best_id, score, matched = gallery_mod.match_embedding(emb, gallery, teacher_id, dlib_enc=d_enc)
            if not matched and best_id is not None and best_id != teacher_id:
                _, _, wrong_confirmed = gallery_mod.match_embedding(emb, gallery, None, dlib_enc=d_enc)
        prev = per_track.get(tr["id"])
        if prev is None or score > prev[1]:
            per_track[tr["id"]] = (tr, score, best_id, matched, wrong_confirmed)

    for tr in to_check:
        if tr["id"] not in per_track and tr["state"] == "VERIFIED_TEACHER":
            tr["last_verify_sec"] = sec - config.REVERIFY_INTERVAL_SEC + 3.0
        else:
            tr["last_verify_sec"] = sec

    for tr, score, best_id, matched, wrong_confirmed in per_track.values():
        tr["best_score"] = max(tr["best_score"], score)
        if matched:
            tr["match_hits"] += 1
            tr["wrong_hits"] = 0
            tr["matched_id"] = best_id
            if tr["match_hits"] >= confirm_frames:
                tr["state"] = "VERIFIED_TEACHER"
        elif wrong_confirmed:
            tr["wrong_hits"] += 1
            tr["wrong_id"] = best_id
            if tr["wrong_hits"] >= confirm_frames:
                tr["state"] = "WRONG_TEACHER"
                tr["match_hits"] = 0
                wrong_seen = True
        else:
            if tr["state"] != "VERIFIED_TEACHER":
                tr["match_hits"] = max(0, tr["match_hits"] - 1)

    return all_scores, wrong_seen


def annotate_frame(frame, tracks, sec, teacher_id, roi):
    vis = frame.copy()
    h, w = vis.shape[:2]
    if roi != (0.0, 0.0, 1.0, 1.0):
        cv2.rectangle(vis, (int(roi[0] * w), int(roi[1] * h)), (int(roi[2] * w), int(roi[3] * h)), (220, 200, 0), 2)

    active = [t for t in tracks if t["missed"] == 0]
    verified_n = sum(1 for t in active if t["state"] == "VERIFIED_TEACHER")
    unverified_n = len(active) - verified_n

    for tr in active:
        x1, y1, x2, y2 = tr["box"]
        if tr["state"] == "VERIFIED_TEACHER":
            color = (40, 190, 60)
            tag = f"#{tr['id']} VERIFIED {teacher_id} ({tr['best_score']:.2f})"
        elif tr["state"] == "WRONG_TEACHER":
            color = (40, 40, 220)
            tag = f"#{tr['id']} WRONG {tr['wrong_id']} ({tr['best_score']:.2f})"
        else:
            color = (0, 165, 255)
            tag = f"#{tr['id']} UNVERIFIED"
        cv2.rectangle(vis, (x1, y1), (x2, y2), color, 2)
        cv2.putText(vis, tag, (x1, max(24, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

    status = f"VERIFIED ({teacher_id})" if verified_n else ("UNVERIFIED PERSON" if unverified_n else "NO PERSON")
    banner = f"t={sec:.1f}s | {status} | Tracks: {verified_n}V / {unverified_n}U"
    cv2.rectangle(vis, (0, 0), (w, 38), (20, 28, 34), -1)
    cv2.putText(vis, banner, (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (240, 248, 255), 2)
    return vis


def analyze_video(
    video_path,
    teacher_id,
    gallery,
    out_dir,
    roi=config.TEACHING_ZONE_ROI,
    sample_fps=config.SAMPLE_FPS,
    snapshot_mode=False,
    save_video=False,
):
    video_path = Path(video_path)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    person_model = load_person_detector()
    face_det, face_emb = gallery_mod.load_face_models()
    confirm_frames = 1 if snapshot_mode else config.VERIFY_CONFIRM_FRAMES

    tracks = []
    history = {}
    next_id = 1
    timeline = []
    face_scores = []
    wrong_teacher_detected = False
    clip_duration_sec = 0.0

    writer = None
    first_frame = None
    first_verified = None
    last_frame = None
    last_verified = None
    mid_frame = None
    mid_verified = None
    mid_err = 1e9
    mid_v_err = 1e9

    t_start = time.perf_counter()
    for sec, frame, est_dur in iter_sampled_frames(video_path, sample_fps):
        clip_duration_sec = max(clip_duration_sec, est_dur, sec)
        if snapshot_mode:
            tracks = []
        persons = detect_persons_in_roi(frame, person_model, roi)
        tracks, next_id = update_tracks(tracks, persons, sec, frame.shape, next_id)

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        scores, wrong_hit = verify_tracks(
            rgb, tracks, sec, gallery, teacher_id, face_det, face_emb, confirm_frames, snapshot_mode
        )
        face_scores.extend(scores)
        wrong_teacher_detected = wrong_teacher_detected or wrong_hit

        for tr in tracks:
            history[tr["id"]] = tr

        active = [t for t in tracks if t["missed"] == 0]
        v_ids = [t["id"] for t in active if t["state"] == "VERIFIED_TEACHER"]
        u_count = len(active) - len(v_ids)
        timeline.append({
            "sec": round(sec, 3),
            "active_track_ids": [t["id"] for t in active],
            "verified_track_ids": v_ids,
            "unverified_count": u_count,
        })

        vis = annotate_frame(frame, tracks, sec, teacher_id, roi)
        if save_video:
            if writer is None:
                vh, vw = vis.shape[:2]
                fourcc = cv2.VideoWriter_fourcc(*"mp4v")
                writer = cv2.VideoWriter(str(out_dir / "annotated.mp4"), fourcc, max(1.0, sample_fps), (vw, vh))
            writer.write(vis)

        if first_frame is None:
            first_frame = vis
        last_frame = vis
        if v_ids:
            if first_verified is None:
                first_verified = vis
            last_verified = vis

        target_mid = 0.5 * clip_duration_sec
        err = abs(sec - target_mid)
        if err < mid_err:
            mid_err = err
            mid_frame = vis
        if v_ids and err < mid_v_err:
            mid_v_err = err
            mid_verified = vis

    if writer is not None:
        writer.release()

    elapsed = max(1e-6, time.perf_counter() - t_start)

    # Retroactively credit continuous track history once a track locks as verified teacher.
    verified_ids = {tid for tid, tr in history.items() if tr["state"] == "VERIFIED_TEACHER"}
    for item in timeline:
        if not snapshot_mode:
            matched_ids = [tid for tid in item["active_track_ids"] if tid in verified_ids]
            item["verified_present"] = bool(matched_ids)
            if matched_ids and item["unverified_count"] > 0:
                extra = len(matched_ids) - len(item["verified_track_ids"])
                item["unverified_count"] = max(0, item["unverified_count"] - max(0, extra))
        else:
            item["verified_present"] = bool(item["verified_track_ids"])

    evidence_paths = {}
    chosen = {
        "entry": first_verified if first_verified is not None else first_frame,
        "mid": mid_verified if mid_verified is not None else mid_frame,
        "exit": last_verified if last_verified is not None else last_frame,
    }
    names = {"entry": "entry.jpg", "mid": "mid_lecture.jpg", "exit": "exit.jpg"}
    for key, img in chosen.items():
        if img is not None:
            fp = out_dir / names[key]
            cv2.imwrite(str(fp), img)
            evidence_paths[key] = str(fp)

    verified_frames = sum(1 for item in timeline if item["verified_present"])
    n_frames = len(timeline)
    diagnostics = {
        "face_sim_min": round(float(min(face_scores)), 4) if face_scores else None,
        "face_sim_median": round(float(np.median(face_scores)), 4) if face_scores else None,
        "face_sim_max": round(float(max(face_scores)), 4) if face_scores else None,
        "track_lock_pct": round(100.0 * verified_frames / n_frames, 2) if n_frames else 0.0,
        "sampled_frames": n_frames,
        "processing_sec": round(elapsed, 2),
        "processing_fps": round(n_frames / elapsed, 2),
        "clip_duration_sec": round(clip_duration_sec, 2),
        "snapshot_mode": snapshot_mode,
        "wrong_teacher_detected": wrong_teacher_detected,
        "annotated_video": str(out_dir / "annotated.mp4") if save_video and (out_dir / "annotated.mp4").exists() else None,
    }

    return {
        "timeline": timeline,
        "evidence_frames": evidence_paths,
        "diagnostics": diagnostics,
    }
