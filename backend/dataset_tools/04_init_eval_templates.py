from common import OUT, write_csv

templates = {
    "attendance_gt": ("session_id date venue course_code student_id student_name manual_status notes",
                      ["EXAMPLE", "2026-01-01", "DemoRoom", "DEMO", "student:S001", "Demo Student", "present", "Replace example (use student:<ID> matching enrollment_verified)"]),
    "teacher_chr_gt": ("session_id date venue course_code teacher_id scheduled_start scheduled_end actual_time_in actual_time_out held_status",
                       ["EXAMPLE", "2026-01-01", "DemoRoom", "DEMO", "teacher:T001", "09:00", "10:00", "09:01", "10:00", "held"]),
    "activity_gt": ("session_id start_sec end_sec student_id activity_label camera_view notes",
                    ["EXAMPLE", 20, 25, "student:S001", "active_phone_use", "student_front", "Replace example (use student:<ID> matching enrollment_verified)"]),
    "gate_log_gt": ("date student_id gate_entry_time source_clip verified",
                    ["2026-01-01", "student:S001", "08:45:00", "Entry_check_point/example.mp4", "false"]),
}

if __name__ == "__main__":
    for group in ("students", "teachers", "unknown"):
        (OUT / "enrollment_verified" / group).mkdir(parents=True, exist_ok=True)
    for name, (header, example) in templates.items():
        path = OUT / "eval_session" / (name + ".csv")
        if not path.exists():
            fields = header.split()
            write_csv(path, fields, [dict(zip(fields, example))])
    print("Evaluation templates ready.")
