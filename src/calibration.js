/**
 * Calibration Module
 * Handles loading and using camera calibration data
 */

class CalibrationManager {
    constructor() {
        this.calibrationData = null;
        this.pixelsPerMm = null;
        this.focalLength = null;
        this.isLoaded = false;
        this.ELEMENT_ID = 'calibrationLoadBtn';
    }

    /**
     * Load calibration data from JSON file
     * @param {File} file - Calibration JSON file
     * @returns {Promise<boolean>} Success status
     */
    async loadFromFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    console.log('Parsed calibration data:', data);
                    this.parseCalibrationData(data);
                    
                    console.log('Calibration loaded, pixels per mm:', this.pixelsPerMm);
                    if (window?.Logger?.log) {
                        window.Logger.log(`✓ Calibration loaded: ${this.pixelsPerMm.toFixed(4)} px/mm`);
                    }
                    resolve(true);
                } catch (error) {
                    console.error('Error parsing calibration:', error);
                    if (window?.Logger?.log) {
                        window.Logger.log(`✗ Error parsing calibration: ${error.message}`);
                    }
                    resolve(false);
                }
            };

            reader.onerror = () => {
                console.error('Error reading calibration file');
                if (window?.Logger?.log) {
                    window.Logger.log('✗ Error reading calibration file');
                }
                resolve(false);
            };

            reader.readAsText(file);
        });
    }

    /**
     * Parse calibration JSON and extract useful values
     * @param {Object} data - Calibration data object
     */
    parseCalibrationData(data) {
        this.calibrationData = data;

        // Extract pixels per mm
        if (data.estimated_pixels_per_mm) {
            this.pixelsPerMm = data.estimated_pixels_per_mm;
            console.log('Using estimated_pixels_per_mm from JSON:', this.pixelsPerMm);
        } else if (data.camera_matrix && Array.isArray(data.camera_matrix)) {
            // Calculate from camera matrix (focal length)
            this.focalLength = data.camera_matrix[0][0]; // fx
            // Estimate pixels per mm from focal length and square size
            this.pixelsPerMm = this.focalLength / (data.square_size_mm || 12);
            console.log('Calculated pixels per mm from camera_matrix:', this.pixelsPerMm);
        } else {
            console.warn('No pixels_per_mm data found in calibration file');
        }

        this.isLoaded = true;
        console.log('Calibration parsed, isLoaded:', this.isLoaded, 'pixelsPerMm:', this.pixelsPerMm);
    }

    /**
     * Convert pixel distance to millimeters using calibration
     * @param {number} pixelDistance - Distance in pixels
     * @returns {number} Distance in millimeters
     */
    pixelsToMillimeters(pixelDistance) {
        if (!this.isLoaded || !this.pixelsPerMm) {
            return null;
        }
        return pixelDistance / this.pixelsPerMm;
    }

    /**
     * Convert millimeters to pixels using calibration
     * @param {number} mmDistance - Distance in millimeters
     * @returns {number} Distance in pixels
     */
    millimetersToPixels(mmDistance) {
        if (!this.isLoaded || !this.pixelsPerMm) {
            return null;
        }
        return mmDistance * this.pixelsPerMm;
    }

    /**
     * Get calibration info for display
     * @returns {Object} Calibration info
     */
    getInfo() {
        if (!this.isLoaded) {
            return {
                loaded: false,
                message: 'No calibration loaded'
            };
        }

        const info = {
            loaded: true,
            pixelsPerMm: this.pixelsPerMm,
            reprojectionError: this.calibrationData?.reprojection_error,
            imageSize: this.calibrationData?.image_size,
            patternSize: this.calibrationData?.pattern_size,
            squareSizeMm: this.calibrationData?.square_size_mm,
            numImages: this.calibrationData?.num_images,
            calibrationDate: this.calibrationData?.calibration_date
        };

        return info;
    }

    /**
     * Clear loaded calibration
     */
    clear() {
        this.calibrationData = null;
        this.pixelsPerMm = null;
        this.focalLength = null;
        this.isLoaded = false;
    }

    /**
     * Get status string for display
     * @returns {string} Status message
     */
    getStatus() {
        if (!this.isLoaded) {
            return 'Calibration: Not loaded (using default)';
        }
        return `Calibration: ${this.pixelsPerMm.toFixed(4)} px/mm (loaded)`;
    }
}

// Create global instance
window.CalibrationManager = new CalibrationManager();
