/**
 * Advanced Camera Calibration Module
 * Supports chessboard calibration method
 */

class CalibrationManager {
    constructor() {
        this.calibrationType = null; // 'chessboard', 'manual'
        this.cameraMatrix = null;
        this.distCoeffs = null;
        this.pixelsPerMM = null;
        this.imageSize = null;

        // Chessboard specific
        this.chessboardImages = [];
        this.chessboardCorners = [];
        this.patternSize = { width: 9, height: 6 }; // Internal corners
        this.squareSize = 25; // mm
    }

    /**
     * Detect chessboard corners in frame
     * @param {cv.Mat} frame - Input frame (grayscale)
     * @param {Object} patternSize - {width, height} of internal corners
     * @returns {Object|null} Detection result
     */
    detectChessboard(frame, patternSize = null) {
        if (!frame) return null;

        const pattern = patternSize || this.patternSize;
        const size = new cv.Size(pattern.width, pattern.height);

        try {
            const corners = new cv.Mat();
            const found = cv.findChessboardCorners(frame, size, corners);

            if (found) {
                // Refine corner positions for better accuracy
                const gray = frame.channels() === 1 ? frame : new cv.Mat();
                if (frame.channels() !== 1) {
                    cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);
                }

                const criteria = new cv.TermCriteria(
                    cv.TERM_CRITERIA_EPS + cv.TERM_CRITERIA_MAX_ITER,
                    30,
                    0.001
                );
                const winSize = new cv.Size(11, 11);
                const zeroZone = new cv.Size(-1, -1);

                cv.cornerSubPix(gray, corners, winSize, zeroZone, criteria);

                if (frame.channels() !== 1) {
                    gray.delete();
                }

                return {
                    found: true,
                    corners: corners,
                    patternSize: pattern
                };
            }

            corners.delete();
            return null;
        } catch (e) {
            console.error('Chessboard detection error:', e);
            return null;
        }
    }

    /**
     * Draw detected chessboard corners
     * @param {cv.Mat} frame - Frame to draw on
     * @param {cv.Mat} corners - Detected corners
     * @param {Object} patternSize - Pattern size
     */
    drawChessboardCorners(frame, corners, patternSize) {
        try {
            const size = new cv.Size(patternSize.width, patternSize.height);
            cv.drawChessboardCorners(frame, size, corners, true);
        } catch (e) {
            console.error('Error drawing chessboard corners:', e);
        }
    }

    /**
     * Add a chessboard image to calibration set
     * @param {cv.Mat} frame - Frame containing chessboard
     * @param {cv.Mat} corners - Detected corners
     * @returns {number} Number of images collected
     */
    addChessboardImage(frame, corners) {
        try {
            // Clone the frame and corners for storage
            const frameClone = frame.clone();
            const cornersClone = corners.clone();

            this.chessboardImages.push(frameClone);
            this.chessboardCorners.push(cornersClone);

            console.log(`Chessboard image ${this.chessboardImages.length} captured`);
            return this.chessboardImages.length;
        } catch (e) {
            console.error('Error adding chessboard image:', e);
            return this.chessboardImages.length;
        }
    }

    /**
     * Compute camera calibration from collected chessboard images
     * @returns {Object} Calibration result
     */
    computeCalibration() {
        if (this.chessboardImages.length < 5) {
            throw new Error('Need at least 5 chessboard images for calibration');
        }

        try {
            const imageSize = new cv.Size(
                this.chessboardImages[0].cols,
                this.chessboardImages[0].rows
            );

            // Prepare object points (3D points in real world space)
            const objectPoints = new cv.MatVector();
            const imagePoints = new cv.MatVector();

            const objPoints = [];
            for (let i = 0; i < this.patternSize.height; i++) {
                for (let j = 0; j < this.patternSize.width; j++) {
                    objPoints.push(j * this.squareSize, i * this.squareSize, 0);
                }
            }

            const objPointsMat = cv.matFromArray(
                this.patternSize.height * this.patternSize.width,
                1,
                cv.CV_32FC3,
                objPoints
            );

            // Add object points for each image
            for (let i = 0; i < this.chessboardCorners.length; i++) {
                objectPoints.push_back(objPointsMat);
                imagePoints.push_back(this.chessboardCorners[i]);
            }

            // Perform calibration
            const cameraMatrix = new cv.Mat();
            const distCoeffs = new cv.Mat();
            const rvecs = new cv.MatVector();
            const tvecs = new cv.MatVector();

            const rms = cv.calibrateCamera(
                objectPoints,
                imagePoints,
                imageSize,
                cameraMatrix,
                distCoeffs,
                rvecs,
                tvecs
            );

            // Store calibration data
            this.cameraMatrix = cameraMatrix;
            this.distCoeffs = distCoeffs;
            this.imageSize = { width: imageSize.width, height: imageSize.height };
            this.calibrationType = 'chessboard';

            // Calculate pixels per mm from camera matrix
            const fx = cameraMatrix.data64F[0];
            const fy = cameraMatrix.data64F[4];
            this.pixelsPerMM = (fx + fy) / (2 * this.squareSize);

            console.log(`Chessboard calibration complete. RMS error: ${rms.toFixed(3)}`);

            // Cleanup
            objPointsMat.delete();
            objectPoints.delete();
            imagePoints.delete();
            rvecs.delete();
            tvecs.delete();

            return {
                success: true,
                rms: rms,
                pixelsPerMM: this.pixelsPerMM,
                numImages: this.chessboardImages.length
            };
        } catch (e) {
            console.error('Calibration computation error:', e);
            throw e;
        }
    }

    /**
     * Apply distortion correction to frame
     * @param {cv.Mat} src - Source frame
     * @param {cv.Mat} dst - Destination frame
     */
    undistortFrame(src, dst) {
        if (!this.cameraMatrix || !this.distCoeffs) {
            src.copyTo(dst);
            return;
        }

        try {
            cv.undistort(src, dst, this.cameraMatrix, this.distCoeffs);
        } catch (e) {
            console.error('Undistort error:', e);
            src.copyTo(dst);
        }
    }

    /**
     * Export calibration data to JSON
     * @returns {Object} Calibration data
     */
    exportCalibrationData() {
        const data = {
            version: '2.0',
            type: this.calibrationType,
            timestamp: new Date().toISOString(),
            pixelsPerMM: this.pixelsPerMM,
            imageSize: this.imageSize
        };

        if (this.cameraMatrix && this.distCoeffs) {
            data.cameraMatrix = Array.from(this.cameraMatrix.data64F);
            data.distCoeffs = Array.from(this.distCoeffs.data64F);
        }

        if (this.calibrationType === 'chessboard') {
            data.patternSize = this.patternSize;
            data.squareSize = this.squareSize;
        }

        return data;
    }

    /**
     * Import calibration data from JSON
     * @param {Object} data - Calibration data
     */
    importCalibrationData(data) {
        try {
            this.calibrationType = data.type || 'manual';
            this.pixelsPerMM = data.pixelsPerMM;
            this.imageSize = data.imageSize;

            if (data.cameraMatrix && data.distCoeffs) {
                this.cameraMatrix = cv.matFromArray(3, 3, cv.CV_64F, data.cameraMatrix);
                this.distCoeffs = cv.matFromArray(1, data.distCoeffs.length, cv.CV_64F, data.distCoeffs);
            }

            if (data.patternSize) {
                this.patternSize = data.patternSize;
            }
            if (data.squareSize) {
                this.squareSize = data.squareSize;
            }

            console.log(`Calibration loaded: ${this.calibrationType}, ${this.pixelsPerMM?.toFixed(3)} px/mm`);
        } catch (e) {
            console.error('Error importing calibration:', e);
            throw e;
        }
    }

    /**
     * Clear chessboard calibration data
     */
    clearChessboardData() {
        this.chessboardImages.forEach(img => img.delete());
        this.chessboardCorners.forEach(corners => corners.delete());
        this.chessboardImages = [];
        this.chessboardCorners = [];
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.clearChessboardData();

        if (this.cameraMatrix) {
            this.cameraMatrix.delete();
            this.cameraMatrix = null;
        }
        if (this.distCoeffs) {
            this.distCoeffs.delete();
            this.distCoeffs = null;
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CalibrationManager = CalibrationManager;
}
