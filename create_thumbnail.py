import subprocess
import sys
from PIL import Image

# Install opencv-python if needed
try:
    import cv2
except ImportError:
    print("Installing opencv-python...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "opencv-python"])
    import cv2

# Extract first frame from video
video_path = 'static/img/works/028-blonde_zoom_kururin.mp4'
thumbnail_path = 'static/img/works/028-blonde_zoom_kururin-thumb.png'

video = cv2.VideoCapture(video_path)
success, frame = video.read()

if success:
    cv2.imwrite(thumbnail_path, frame)
    print(f"✓ Thumbnail created: {thumbnail_path}")
else:
    print("✗ Failed to read video frame")

video.release()
