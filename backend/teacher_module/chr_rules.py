from datetime import datetime, timedelta
from pathlib import Path

if __package__:
    from . import config
else:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from backend.teacher_module import config


def parse_clock(clock_str):
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(clock_str.strip(), fmt)
        except ValueError:
            continue
    raise ValueError(f"Expected HH:MM or HH:MM:SS clock time, got {clock_str!r}")


def format_clock(base_dt, offset_sec):
    return (base_dt + timedelta(seconds=float(offset_sec))).strftime("%H:%M:%S")


def extract_segments(timeline, key, step_sec):
    segments = []
    start = None
    prev = None
    for item in timeline:
        sec = item["sec"]
        active = bool(item[key]) if isinstance(item[key], bool) else item[key] > 0
        if active:
            if start is None:
                start = sec
            prev = sec
        elif start is not None:
            segments.append((start, prev + step_sec))
            start = None
            prev = None
    if start is not None:
        segments.append((start, prev + step_sec))
    return segments


def build_chr_report(
    vision_result,
    session_id,
    venue,
    scheduled_teacher_id,
    scheduled_start,
    scheduled_end,
    video_start_clock,
    sample_fps=config.SAMPLE_FPS,
):
    timeline = vision_result["timeline"]
    diagnostics = vision_result["diagnostics"]
    clip_dur = max(1e-6, float(diagnostics["clip_duration_sec"]))
    step_sec = 1.0 / max(0.1, float(sample_fps))

    sched_start_dt = parse_clock(scheduled_start)
    sched_end_dt = parse_clock(scheduled_end)
    vid_start_dt = parse_clock(video_start_clock)

    raw_segments = extract_segments(timeline, "verified_present", step_sec)
    min_seg = min(config.MIN_PRESENCE_DEBOUNCE_SEC, clip_dur)
    kept_segments = [(s, min(e, clip_dur)) for s, e in raw_segments if (min(e, clip_dur) - s) >= min_seg]

    active_sec = sum(e - s for s, e in kept_segments)
    coverage_pct = min(100.0, round(100.0 * active_sec / clip_dur, 2))
    held_ratio = active_sec / clip_dur

    unverified_only = [
        {"sec": item["sec"], "u": (not item["verified_present"]) and item["unverified_count"] > 0}
        for item in timeline
    ]
    unverified_segments = extract_segments(unverified_only, "u", step_sec)
    unverified_sec = sum(min(e, clip_dur) - s for s, e in unverified_segments if (min(e, clip_dur) - s) >= min_seg)

    flags = []
    if held_ratio < config.MIN_HELD_RATIO or active_sec < min_seg:
        held_status = "Not Held"
        actual_in = None
        actual_out = None
        late_min = None
        early_min = None
        entry_observed = None
        exit_observed = None
    else:
        first_sec = kept_segments[0][0]
        last_sec = kept_segments[-1][1]
        actual_in_dt = vid_start_dt + timedelta(seconds=first_sec)
        actual_out_dt = vid_start_dt + timedelta(seconds=last_sec)
        actual_in = actual_in_dt.strftime("%H:%M:%S")
        actual_out = actual_out_dt.strftime("%H:%M:%S")

        late_min = round(max(0.0, (actual_in_dt - sched_start_dt).total_seconds() / 60.0), 2)
        early_min = round(max(0.0, (sched_end_dt - actual_out_dt).total_seconds() / 60.0), 2)
        held_status = "Late" if late_min > config.GRACE_LATE_MINUTES else "Held on Time"

        entry_observed = first_sec > config.EDGE_OBSERVE_SEC
        exit_observed = last_sec < max(0.0, clip_dur - config.EDGE_OBSERVE_SEC)
        if not entry_observed:
            flags.append("entry_not_observed")
        if not exit_observed:
            flags.append("exit_not_observed")

    if unverified_sec >= min_seg:
        flags.append("unverified_person_in_teaching_zone")
    if diagnostics.get("wrong_teacher_detected"):
        flags.append("wrong_teacher_detected")

    return {
        "session_id": session_id,
        "venue": venue,
        "scheduled_teacher_id": scheduled_teacher_id,
        "scheduled_start": scheduled_start,
        "scheduled_end": scheduled_end,
        "video_start_clock": video_start_clock,
        "actual_time_in": actual_in,
        "actual_time_out": actual_out,
        "late_in_minutes": late_min,
        "early_out_minutes": early_min,
        "active_presence_seconds": round(active_sec, 2),
        "presence_coverage_pct": coverage_pct,
        "held_status": held_status,
        "entry_observed": entry_observed,
        "exit_observed": exit_observed,
        "flags": flags,
        "evidence_frames": vision_result["evidence_frames"],
        "diagnostics": diagnostics,
    }
