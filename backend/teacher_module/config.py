import os
import sys
from pathlib import Path

RAW_DATA_DIR = Path(os.environ.get("MEYE_DATASET_RAW", r"C:\Users\Muneeb\PycharmProjects\Fyp_model\DataSet"))
CURATED_DIR = Path(os.environ.get("MEYE_DATASET_CURATED", r"C:\Users\Muneeb\PycharmProjects\Fyp_model\dataset_curated"))
OUTPUT_ROOT = Path(os.environ.get("MEYE_OUTPUT_DIR", r"C:\Users\Muneeb\PycharmProjects\Fyp_model\outputs\teacher_runs"))
GALLERY_PATH = OUTPUT_ROOT / "teacher_gallery.npz"
MODELS_DIR = OUTPUT_ROOT / "_models"

# Sampling and detection thresholds
SAMPLE_FPS = 1.0
PERSON_CONF_THRESHOLD = 0.30
PERSON_NMS_THRESHOLD = 0.45
FACE_DET_CONF = 0.90
MIN_FACE_PX = 22

# Teacher verification and tracking
FACE_SIM_THRESHOLD = 0.68
DLIB_DIST_THRESHOLD = 0.46
VERIFY_CONFIRM_FRAMES = 2
REVERIFY_INTERVAL_SEC = 15.0
UNVERIFIED_CHECK_INTERVAL_SEC = 2.0
TRACK_IOU_THRESHOLD = 0.25
TRACK_MAX_MISSED_FRAMES = 5

# BIIT Class Held Report (CHR) policy
MIN_PRESENCE_DEBOUNCE_SEC = 5.0
GRACE_LATE_MINUTES = 10
MIN_HELD_RATIO = 0.25
EDGE_OBSERVE_SEC = 3.0

# Normalized (x1, y1, x2, y2) teaching zone ROI; configurable per venue
TEACHING_ZONE_ROI = (0.0, 0.0, 1.0, 1.0)
VENUE_ROIS = {}


def get_venue_roi(venue):
    return VENUE_ROIS.get(venue, TEACHING_ZONE_ROI)


def ensure_cuda_dlls():
    dlls = Path(sys.prefix) / "Library" / "bin"
    if sys.platform == "win32" and dlls.is_dir():
        path_val = os.environ.get("PATH", "")
        if str(dlls) not in path_val:
            os.environ["PATH"] = str(dlls) + os.pathsep + path_val
        os.add_dll_directory(str(dlls))
