import argparse
import json
import re
from pathlib import Path

if __package__:
    from . import chr_rules, config, gallery as gallery_mod, vision
else:
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from backend.teacher_module import chr_rules, config, gallery as gallery_mod, vision


def parse_roi(raw):
    if not raw:
        return None
    parts = [float(p.strip()) for p in raw.split(",")]
    if len(parts) != 4 or parts[0] >= parts[2] or parts[1] >= parts[3]:
        raise ValueError("ROI must be normalized x1,y1,x2,y2 with x1<x2 and y1<y2")
    return tuple(parts)


def main():
    parser = argparse.ArgumentParser(description="Run Teacher Monitoring & Class Held Report (CHR).")
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--teacher-id", default="teacher:Naseer")
    parser.add_argument("--venue", default="L1")
    parser.add_argument("--session-id", default=None)
    parser.add_argument("--scheduled-start", default="09:00:00")
    parser.add_argument("--scheduled-end", default="10:00:00")
    parser.add_argument("--video-start-clock", default="09:00:00")
    parser.add_argument("--run-name", default=None)
    parser.add_argument("--gallery", type=Path, default=config.GALLERY_PATH)
    parser.add_argument("--roi", default=None, help="Normalized x1,y1,x2,y2")
    parser.add_argument("--sample-fps", type=float, default=config.SAMPLE_FPS)
    parser.add_argument("--snapshot-mode", action="store_true")
    parser.add_argument("--save-video", action="store_true")
    args = parser.parse_args()

    run_name = args.run_name or re.sub(r"[^A-Za-z0-9._-]+", "_", args.video.stem)
    session_id = args.session_id or args.video.stem
    out_dir = config.OUTPUT_ROOT / run_name
    roi = parse_roi(args.roi) or config.get_venue_roi(args.venue)

    gallery = gallery_mod.load_gallery(args.gallery)
    vis_result = vision.analyze_video(
        video_path=args.video,
        teacher_id=args.teacher_id,
        gallery=gallery,
        out_dir=out_dir,
        roi=roi,
        sample_fps=args.sample_fps,
        snapshot_mode=args.snapshot_mode,
        save_video=args.save_video,
    )
    report = chr_rules.build_chr_report(
        vision_result=vis_result,
        session_id=session_id,
        venue=args.venue,
        scheduled_teacher_id=args.teacher_id,
        scheduled_start=args.scheduled_start,
        scheduled_end=args.scheduled_end,
        video_start_clock=args.video_start_clock,
        sample_fps=args.sample_fps,
    )

    report_path = out_dir / "chr_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Saved CHR report -> {report_path}")


if __name__ == "__main__":
    main()
