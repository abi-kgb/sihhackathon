import cv2
import numpy as np

class NightVisionEnhancer:
    """
    Enhances low-light and night-time border surveillance video frames.
    Provides CLAHE contrast enhancement, gamma adjustment, and thermal-IR pseudo-coloring.
    """
    def __init__(self, clip_limit: float = 3.0, tile_grid_size=(8, 8)):
        self.clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)

    def enhance_low_light(self, frame: np.ndarray, gamma: float = 1.6) -> np.ndarray:
        """
        Enhances dark frames using YUV color space CLAHE and gamma correction.
        """
        if frame is None or frame.size == 0:
            return frame

        # Convert to YUV to enhance luminance channel without distorting color
        yuv = cv2.cvtColor(frame, cv2.COLOR_BGR2YUV)
        yuv[:, :, 0] = self.clahe.apply(yuv[:, :, 0])
        enhanced = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)

        # Gamma correction for dark regions
        inv_gamma = 1.0 / gamma
        table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
        gamma_corrected = cv2.LUT(enhanced, table)

        return gamma_corrected

    def apply_thermal_ir_palette(self, frame: np.ndarray) -> np.ndarray:
        """
        Transforms standard/low-light feed into high-contrast Thermal IR visualization.
        """
        if frame is None or frame.size == 0:
            return frame

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Apply CLAHE to grayscale thermal intensities
        enhanced_gray = self.clahe.apply(gray)
        # Apply JET / INFERNO pseudo-color thermal map
        thermal = cv2.applyColorMap(enhanced_gray, cv2.COLORMAP_JET)
        return thermal
