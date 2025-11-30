// Constants
const ELEMENT_IDS = {
    VIDEO: 'video',
    CANVAS: 'canvas',
    INFO: 'info',
    START_BTN: 'startBtn',
    LOG_BODY: 'logBody',
    LOG_TOGGLE: 'logToggle',
    LOG_CLEAR: 'logClear',
    LOG_DOWNLOAD: 'logDownload',
    CAMERA_REFRESH: 'cameraRefresh',
    CAMERA_REQUEST: 'cameraRequest',
    CAMERA_SELECT: 'cameraSelect',
    OPEN_DETAIL: 'openDetail',
    AUTO_SAVE: 'autoSave',
    CHOOSE_FOLDER: 'chooseFolder',
    SAVE_FOLDER_LABEL: 'saveFolderLabel',
    OBJECT_NAME: 'objectName',
    EXPORT_CSV_BTN: 'exportCsvBtn',
    DEBUG_TOGGLE: 'debugToggle',
    BINARY_TOGGLE: 'binaryToggle',
    SHADOW_TOGGLE: 'shadowToggle',
    APP_FOOTER: 'appFooter',
    FOOTER_TOGGLE: 'footerToggle',
    SAVE_CAL_BTN: 'saveCalBtn',
    LOAD_CAL_BTN: 'loadCalBtn',
    CAL_FILE_INPUT: 'calFileInput',
    // Advanced Calibration
    CHESS_SQUARE_SIZE: 'chessSquareSize',
    CHESS_PATTERN_SIZE: 'chessPatternSize',
    START_CHESS_CALIB: 'startChessCalib',
    COMPUTE_CHESS_CALIB: 'computeChessCalib',
    CLEAR_CHESS_IMAGES: 'clearChessImages',
    CHESS_IMAGE_COUNT: 'chessImageCount',
    CHESS_PANEL: 'chessPanel',
    MANUAL_PANEL: 'manualPanel',
    CALIB_STATUS: 'calibStatus'
};

const DEFAULT_CONFIG = {
    WIDTH: 1280,
    HEIGHT: 720,
    PIXEL_BASE: 10,
    CAL_RANGE: 72,
    CAL_BASE: 5,
    UNIT_SUFFIX: 'mm',
    MAX_LOGS: 1000,
    AUTO_PERCENT: 0.2,
    AUTO_THRESHOLD: 127,
    AUTO_BLUR: 5,
    NORM_ALPHA: 0,
    NORM_BETA: 255,
    JPEG_QUALITY: 0.92,
    CSV_FLUSH_DELAY: 2000,
    AUTO_PERCENT_MAX: 60 // Max percent for auto detection
};

const COLOR_PALETTE = {
    red: '#ff0000',
    green: '#00ff00',
    blue: '#0000ff',
    yellow: '#ffff00',
    gray: '#c8c8c8',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    orange: '#ff8800',
    purple: '#8800ff',
    lime: '#88ff00',
    pink: '#ff0088'
};

const AUTO_COLOR_SEQUENCE = [
    'red', 'green', 'blue', 'yellow', 'cyan',
    'magenta', 'orange', 'purple', 'lime', 'pink'
];

const ACTION_TO_KEY_MAP = {
    quit: 'q',
    config: 'c',
    norms: 'n',
    rotate: 'r',
    auto: 'a',
    percent: 'p',
    thresh: 't'
};

const KEY_CODE_MAP = {
    KeyQ: 'q',
    KeyC: 'c',
    KeyN: 'n',
    KeyR: 'r',
    KeyA: 'a',
    KeyP: 'p',
    KeyT: 't',
    Escape: 'escape'
};

class CamRuler {
    constructor() {
        // DOM Elements
        this.video = document.getElementById(ELEMENT_IDS.VIDEO);
        this.canvas = document.getElementById(ELEMENT_IDS.CANVAS);
        this.ctx = this.canvas.getContext('2d');
        this.info = document.getElementById(ELEMENT_IDS.INFO);

        // Video dimensions
        this.width = DEFAULT_CONFIG.WIDTH;
        this.height = DEFAULT_CONFIG.HEIGHT;
        this.stream = null;
        this.animationId = null;

        // OpenCV matrices
        this.src = null;
        this.dst = null;
        this.gray = null;
        this.blurred = null;
        this.thresh = null;

        // Calibration settings
        this.pixelBase = DEFAULT_CONFIG.PIXEL_BASE;
        this.calRange = DEFAULT_CONFIG.CAL_RANGE;
        this.calBase = DEFAULT_CONFIG.CAL_BASE;
        this.calLast = null;
        this.cal = {};
        this.unitSuffix = DEFAULT_CONFIG.UNIT_SUFFIX;

        // Mouse state
        this.mouseRaw = { x: 0, y: 0 };
        this.mouseNow = { x: 0, y: 0 };
        this.mouseMark = null;
        this.rightMouseDown = false;

        // Key flags for different modes
        this.keyFlags = {
            config: false,
            auto: false,
            thresh: false,
            percent: false,
            norms: false,
            rotate: false,
            lock: false,
            circleMode: false
        };

        // Auto mode settings
        this.autoPercent = DEFAULT_CONFIG.AUTO_PERCENT;
        this.autoThreshold = DEFAULT_CONFIG.AUTO_THRESHOLD;
        this.autoBlur = DEFAULT_CONFIG.AUTO_BLUR;

        // Normalization settings
        this.normAlpha = DEFAULT_CONFIG.NORM_ALPHA;
        this.normBeta = DEFAULT_CONFIG.NORM_BETA;

        // Color scheme
        this.colors = COLOR_PALETTE;
        this.autoColors = AUTO_COLOR_SEQUENCE;

        // Canvas center and dimensions
        this.cx = 0;
        this.cy = 0;
        this.dm = 0;
        this.area = 0;

        // Logging (legacy - delegated to Logger module)
        this.logBuffer = [];
        this.maxLogs = DEFAULT_CONFIG.MAX_LOGS;
        this.logEl = null;
        this.logVisible = false;
        this.binaryMode = false;
        this.shadowRemovalMode = false;

        // Auto-save settings
        this.autoSave = false;
        this.saveDirHandle = null;

        // Advanced Calibration
        this.calibrationManager = null;

        this.setupEventListeners();
        this.initializeModules();
    }

    // Helper: Initialize external modules
    initializeModules() {
        try {
            if (window?.Menu) {
                this.menu = new window.Menu(this);
            }
            if (window?.CSVStore?.setUnitSuffix) {
                window.CSVStore.setUnitSuffix(this.unitSuffix);
            }
            if (window?.CalibrationManager) {
                this.calibrationManager = new window.CalibrationManager();
                console.log('Calibration Manager initialized');
            }
        } catch (e) {
            console.warn('Error initializing modules:', e);
        }
    }

    // Helper: Get element by ID
    getElement(id) {
        return document.getElementById(id);
    }

    setupEventListeners() {
        this.setupCameraControls();
        this.setupCanvasInteraction();
        this.setupControlButtons();
        this.setupLogging();
        this.setupSaveControls();
        this.setupFooterControls();
        this.setupDebugLogging();
        this.setupCalibrationControls();
    }

    setupCameraControls() {
        const startBtn = this.getElement(ELEMENT_IDS.START_BTN);
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (typeof cvReady !== 'undefined' && cvReady) {
                    this.startCamera();
                } else {
                    alert('OpenCV.js is still loading. Please wait...');
                }
            });
        }

        const cameraRefresh = this.getElement(ELEMENT_IDS.CAMERA_REFRESH);
        const cameraRequest = this.getElement(ELEMENT_IDS.CAMERA_REQUEST);
        const openDetailBtn = this.getElement(ELEMENT_IDS.OPEN_DETAIL);
        const cameraSelect = this.getElement(ELEMENT_IDS.CAMERA_SELECT);

        if (cameraRefresh) {
            cameraRefresh.addEventListener('click', () => this.populateCameraList());
        }
        if (cameraRequest) {
            cameraRequest.addEventListener('click', () => this.requestPermissionAndRescan());
        }
        if (openDetailBtn) {
            openDetailBtn.addEventListener('click', () => {
                window.location.href = 'gallery_detail.html';
            });
        }
        if (cameraSelect) {
            cameraSelect.addEventListener('change', () => {
                const val = cameraSelect.value || 'default';
                this.addLog(`Camera selected: ${val}`);
            });
        }

        this.populateCameraList();
    }

    setupCanvasInteraction() {
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleMouseClick(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e);
        });
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    setupControlButtons() {
        const controlButtons = document.querySelectorAll('#controls button[data-action]');
        if (controlButtons?.forEach) {
            controlButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;

                    // Try to delegate to Menu module
                    try {
                        if (this.menu?.handleControlAction) {
                            this.menu.handleControlAction(action);
                        } else if (typeof this.handleControlAction === 'function') {
                            this.handleControlAction(action);
                        }
                    } catch (e) {
                        console.warn('Control action failed:', e);
                    }

                    // Synthesize keyboard event for backward compatibility
                    try {
                        const key = ACTION_TO_KEY_MAP[action];
                        if (key) {
                            if (window?.Logger?.add) {
                                window.Logger.add(`SYNTH key dispatch: ${key} for action ${action}`, 'debug');
                            }
                            const kd = new KeyboardEvent('keydown', { key });
                            document.dispatchEvent(kd);
                            try {
                                this.updateControlUI();
                            } catch (e) {
                                console.warn('UI update failed:', e);
                            }
                        }
                    } catch (e) {
                        console.warn('Keyboard event synthesis failed:', e);
                    }
                });
            });
        }

        this.updateControlUI();
    }

    setupLogging() {
        this.logEl = this.getElement(ELEMENT_IDS.LOG_BODY);
        const logToggle = this.getElement(ELEMENT_IDS.LOG_TOGGLE);
        const logClear = this.getElement(ELEMENT_IDS.LOG_CLEAR);
        const logDownload = this.getElement(ELEMENT_IDS.LOG_DOWNLOAD);

        if (logToggle) {
            logToggle.addEventListener('click', () => {
                if (window.Logger) window.Logger.toggle();
            });
        }
        if (logClear) {
            logClear.addEventListener('click', () => {
                if (window.Logger) window.Logger.clear();
            });
        }
        if (logDownload) {
            logDownload.addEventListener('click', () => {
                if (window.Logger) window.Logger.download();
            });
        }
    }

    setupSaveControls() {
        const autoSaveCheckbox = this.getElement(ELEMENT_IDS.AUTO_SAVE);
        const chooseFolderBtn = this.getElement(ELEMENT_IDS.CHOOSE_FOLDER);
        const saveFolderLabel = this.getElement(ELEMENT_IDS.SAVE_FOLDER_LABEL);
        const exportCsvBtn = this.getElement(ELEMENT_IDS.EXPORT_CSV_BTN);

        if (autoSaveCheckbox) {
            autoSaveCheckbox.addEventListener('change', (e) => {
                this.autoSave = !!e.target.checked;
                this.addLog('Auto-save ' + (this.autoSave ? 'enabled' : 'disabled'));
            });
        }

        if (chooseFolderBtn) {
            chooseFolderBtn.addEventListener('click', async () => {
                await this.handleFolderSelection(saveFolderLabel);
            });
        }

        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                if (window.CSVStore) {
                    window.CSVStore.exportAll();
                }
            });
        }

        // Calibration Save/Load
        const saveCalBtn = this.getElement(ELEMENT_IDS.SAVE_CAL_BTN);
        if (saveCalBtn) {
            saveCalBtn.addEventListener('click', () => this.saveCalibration());
        }

        const loadCalBtn = this.getElement(ELEMENT_IDS.LOAD_CAL_BTN);
        const calFileInput = this.getElement(ELEMENT_IDS.CAL_FILE_INPUT);

        if (loadCalBtn && calFileInput) {
            loadCalBtn.addEventListener('click', () => calFileInput.click());
            calFileInput.addEventListener('change', (e) => this.loadCalibration(e));
        }
    }

    async handleFolderSelection(saveFolderLabel) {
        try {
            if (!window.showDirectoryPicker) {
                this.addLog('File System Access API not available, will download files instead', 'warn');
                if (saveFolderLabel) {
                    saveFolderLabel.textContent = '(downloads)';
                }
                return;
            }

            const handle = await window.showDirectoryPicker();

            // Try to create/access imgs subdirectory
            try {
                const imgsHandle = await handle.getDirectoryHandle('imgs', { create: true });
                this.saveDirHandle = imgsHandle;
                if (window.CSVStore) {
                    window.CSVStore.saveDirHandle = imgsHandle;
                }
                this.addLog('Save folder set to: imgs (inside chosen directory)');
                if (saveFolderLabel) {
                    saveFolderLabel.textContent = 'imgs (chosen dir)';
                }
            } catch (e) {
                // Fallback to root directory
                this.saveDirHandle = handle;
                if (window.CSVStore) {
                    window.CSVStore.saveDirHandle = handle;
                }
                this.addLog('Save folder set to chosen directory');
                if (saveFolderLabel) {
                    saveFolderLabel.textContent = '(chosen directory)';
                }
            }
        } catch (err) {
            this.addLog(
                'Folder selection cancelled or failed: ' + (err?.message || err),
                'warn'
            );
        }
    }

    setupFooterControls() {
        const footerEl = this.getElement(ELEMENT_IDS.APP_FOOTER);
        const footerToggle = this.getElement(ELEMENT_IDS.FOOTER_TOGGLE);

        try {
            if (footerEl) {
                const collapsed = localStorage.getItem('camruler_footer_collapsed') === '1';
                if (collapsed) {
                    footerEl.classList.add('collapsed');
                }
            }

            if (footerToggle && footerEl) {
                footerToggle.addEventListener('click', () => {
                    const nowCollapsed = footerEl.classList.toggle('collapsed');
                    try {
                        localStorage.setItem('camruler_footer_collapsed', nowCollapsed ? '1' : '0');
                    } catch (e) {
                        console.warn('Failed to save footer state:', e);
                    }
                });
            }
        } catch (e) {
            console.warn('Footer controls setup failed:', e);
        }
    }

    setupDebugLogging() {
        const debugToggleBtn = this.getElement(ELEMENT_IDS.DEBUG_TOGGLE);
        const binaryToggleBtn = this.getElement(ELEMENT_IDS.BINARY_TOGGLE);
        const shadowToggleBtn = this.getElement(ELEMENT_IDS.SHADOW_TOGGLE);

        // Debug toggle
        try {
            if (debugToggleBtn && window?.Logger?.toggleDebug) {
                debugToggleBtn.textContent = window.Logger.debugEnabled ? 'Debug: ON' : 'Debug: OFF';
                debugToggleBtn.addEventListener('click', () => {
                    window.Logger.toggleDebug();
                    debugToggleBtn.textContent = window.Logger.debugEnabled ? 'Debug: ON' : 'Debug: OFF';
                });
            }
        } catch (e) {
            console.warn('Debug toggle setup failed:', e);
        }

        // Binary mode toggle
        try {
            if (binaryToggleBtn) {
                binaryToggleBtn.textContent = this.binaryMode ? 'Binary: ON' : 'Binary: OFF';
                binaryToggleBtn.addEventListener('click', () => {
                    this.binaryMode = !this.binaryMode;
                    binaryToggleBtn.textContent = this.binaryMode ? 'Binary: ON' : 'Binary: OFF';
                    this.addLog(`Binary view ${this.binaryMode ? 'enabled' : 'disabled'}`, 'info');
                });
            }
        } catch (e) {
            console.warn('Binary toggle setup failed:', e);
        }

        // Shadow removal toggle
        try {
            if (shadowToggleBtn && window.ShadowRemoval) {
                shadowToggleBtn.textContent = this.shadowRemovalMode ? 'Shadow Removal: ON' : 'Shadow Removal: OFF';
                shadowToggleBtn.addEventListener('click', () => {
                    this.shadowRemovalMode = !this.shadowRemovalMode;
                    window.ShadowRemoval.setEnabled(this.shadowRemovalMode);
                    shadowToggleBtn.textContent = this.shadowRemovalMode ? 'Shadow Removal: ON' : 'Shadow Removal: OFF';
                    this.addLog(`Shadow removal ${this.shadowRemovalMode ? 'enabled' : 'disabled'}`, 'info');
                });
            }
        } catch (e) {
            console.warn('Binary toggle setup failed:', e);
        }

        // Debug logging for all buttons
        try {
            const debugBtns = document.querySelectorAll('#controls button, #appFooter button');
            debugBtns.forEach(b => {
                b.addEventListener('click', () => {
                    const id = b.id || b.dataset.action || b.textContent.trim().slice(0, 30);
                    if (window?.Logger?.add) {
                        window.Logger.add(`DEBUG click: ${id}`, 'debug');
                    } else {
                        console.debug('DEBUG click:', id);
                    }
                });
            });
        } catch (e) {
            console.warn('Debug button logging setup failed:', e);
        }
    }
    // Setup Advanced Calibration Controls
    setupCalibrationControls() {
        // Chessboard calibration buttons
        const startChessBtn = this.getElement(ELEMENT_IDS.START_CHESS_CALIB);
        const computeChessBtn = this.getElement(ELEMENT_IDS.COMPUTE_CHESS_CALIB);
        const clearChessBtn = this.getElement(ELEMENT_IDS.CLEAR_CHESS_IMAGES);

        if (startChessBtn) {
            startChessBtn.addEventListener('click', () => {
                console.log('Capture button clicked');
                this.captureChessboardImage();
            });
        }
        if (computeChessBtn) {
            computeChessBtn.addEventListener('click', () => this.computeChessboardCalibration());
        }
        if (clearChessBtn) {
            clearChessBtn.addEventListener('click', () => this.clearChessboardImages());
        }
    }
    // Capture chessboard image
    captureChessboardImage() {
        console.log('Attempting to capture chessboard image...');
        if (!this.calibrationManager) {
            console.error('Calibration manager not initialized');
            this.showCalibStatus('Calibration system not ready', 'error');
            return;
        }
        if (!this.src) {
            console.error('Video source not ready');
            this.showCalibStatus('Camera not ready', 'error');
            return;
        }

        try {
            // Get pattern size
            const patternInput = this.getElement(ELEMENT_IDS.CHESS_PATTERN_SIZE);
            const patternStr = patternInput ? patternInput.value : '9x6';
            const [width, height] = patternStr.split('x').map(Number);
            const patternSize = { width: width - 1, height: height - 1 }; // Internal corners

            // Detect chessboard
            const gray = new cv.Mat();
            cv.cvtColor(this.src, gray, cv.COLOR_RGBA2GRAY);

            const detection = this.calibrationManager.detectChessboard(gray, patternSize);

            if (detection && detection.found) {
                // Draw corners
                this.calibrationManager.drawChessboardCorners(this.dst, detection.corners, patternSize);

                // Add image to calibration set
                const count = this.calibrationManager.addChessboardImage(gray, detection.corners);

                // Update UI
                const countEl = this.getElement(ELEMENT_IDS.CHESS_IMAGE_COUNT);
                if (countEl) countEl.textContent = count;

                const computeBtn = this.getElement(ELEMENT_IDS.COMPUTE_CHESS_CALIB);
                if (computeBtn) computeBtn.disabled = count < 5;

                this.showCalibStatus(`✓ Image ${count} captured`, 'success');
                this.addLog(`Chessboard image ${count} captured`, 'info');

                detection.corners.delete();
            } else {
                this.showCalibStatus('Chessboard not found - adjust position', 'warning');
            }

            gray.delete();
        } catch (e) {
            console.error('Chessboard capture error:', e);
            this.showCalibStatus('Error: ' + e.message, 'error');
        }
    }

    // Compute chessboard calibration
    computeChessboardCalibration() {
        if (!this.calibrationManager) {
            this.showCalibStatus('Calibration manager not initialized', 'error');
            return;
        }

        try {
            // Get square size
            const squareSizeInput = this.getElement(ELEMENT_IDS.CHESS_SQUARE_SIZE);
            const squareSize = squareSizeInput ? parseFloat(squareSizeInput.value) : 25;

            this.calibrationManager.squareSize = squareSize;

            this.showCalibStatus('Computing calibration...', 'info');

            const result = this.calibrationManager.computeCalibration();

            if (result.success) {
                this.showCalibStatus(`✓ Calibrated! RMS: ${result.rms.toFixed(3)}`, 'success');
                this.addLog(`Chessboard calibration complete: ${result.pixelsPerMM.toFixed(3)} px/mm, RMS: ${result.rms.toFixed(3)}`, 'info');

                // Apply to legacy calibration system
                this.applyAdvancedCalibration();
            }
        } catch (e) {
            console.error('Chessboard calibration error:', e);
            this.showCalibStatus('Error: ' + e.message, 'error');
        }
    }

    // Clear chessboard images
    clearChessboardImages() {
        if (!this.calibrationManager) return;

        this.calibrationManager.clearChessboardData();

        const countEl = this.getElement(ELEMENT_IDS.CHESS_IMAGE_COUNT);
        if (countEl) countEl.textContent = '0';

        const computeBtn = this.getElement(ELEMENT_IDS.COMPUTE_CHESS_CALIB);
        if (computeBtn) computeBtn.disabled = true;

        this.showCalibStatus('Images cleared', 'info');
        this.addLog('Chessboard images cleared', 'info');
    }

    // Apply advanced calibration to legacy system
    applyAdvancedCalibration() {
        if (!this.calibrationManager || !this.calibrationManager.pixelsPerMM) return;

        const pixelsPerMM = this.calibrationManager.pixelsPerMM;

        // Update legacy calibration table
        for (let x = 0; x <= this.dm; x += this.pixelBase) {
            this.cal[x] = pixelsPerMM;
        }

        this.addLog(`Applied calibration: ${pixelsPerMM.toFixed(3)} px/mm`, 'info');
    }

    // Show calibration status message
    showCalibStatus(message, type = 'info') {
        const statusEl = this.getElement(ELEMENT_IDS.CALIB_STATUS);
        if (!statusEl) return;

        statusEl.textContent = message;
        statusEl.className = `calib-status ${type}`;

        // Auto-hide success/info messages after 5 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (statusEl.textContent === message) {
                    statusEl.className = 'calib-status';
                }
            }, 5000);
        }
    }


    async requestPermissionAndRescan() {
        if (!navigator.mediaDevices?.getUserMedia) {
            this.addLog('Media Devices API not available in this browser', 'warn');
            return;
        }

        try {
            this.addLog('Requesting camera permission...');
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });

            // Stop the stream immediately
            try {
                stream.getTracks().forEach(t => t.stop());
            } catch (e) {
                console.warn('Failed to stop temp stream:', e);
            }

            setTimeout(() => this.populateCameraList(), 300);
        } catch (e) {
            this.addLog('Permission denied or no camera: ' + (e?.message || e), 'warn');
            setTimeout(() => this.populateCameraList(), 300);
        }
    }

    async populateCameraList() {
        const select = this.getElement(ELEMENT_IDS.CAMERA_SELECT);
        if (!select || !navigator.mediaDevices?.enumerateDevices) {
            return;
        }

        const enumerate = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const cams = devices.filter(d => d.kind === 'videoinput');

                select.innerHTML = '<option value="">Default camera</option>';
                cams.forEach((d, i) => {
                    const label = d.label || `Camera ${i + 1}`;
                    const opt = document.createElement('option');
                    opt.value = d.deviceId;
                    opt.textContent = label;
                    select.appendChild(opt);
                });

                this.addLog(`Found ${cams.length} video input device(s)`);
            } catch (err) {
                this.addLog('Error enumerating devices: ' + (err?.message || err), 'warn');
            }
        };

        try {
            await enumerate();

            // Check if we have labels
            const hasLabels = Array.from(select.options).some(
                o => o.text && o.text !== 'Default camera'
            );

            if (!hasLabels) {
                this.addLog('Requesting temporary permission to access cameras to read labels...');
                let tempStream = null;

                try {
                    tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
                } catch (e) {
                    this.addLog('Permission denied or no camera available: ' + (e?.message || e), 'warn');
                }

                await enumerate();

                if (tempStream) {
                    try {
                        tempStream.getTracks().forEach(t => t.stop());
                    } catch (e) {
                        console.warn('Failed to stop temp stream:', e);
                    }
                }
            }
        } catch (e) {
            this.addLog('populateCameraList error: ' + e, 'warn');
        }
    }

    addLog(message, level = 'info') {
        if (window?.Logger?.add) {
            window.Logger.add(message, level);
        } else {
            // Fallback to console
            const ts = new Date().toISOString();
            const line = `[${ts}] ${message}`;

            if (level === 'error') {
                console.error(line);
            } else if (level === 'warn') {
                console.warn(line);
            } else {
                console.log(line);
            }
        }
    }

    toggleLogs() {
        if (window.Logger?.toggle) {
            return window.Logger.toggle();
        }
    }

    clearLogs() {
        if (window.Logger?.clear) {
            return window.Logger.clear();
        }
    }

    downloadLogs() {
        if (window.Logger?.download) {
            return window.Logger.download();
        }
    }

    // JSON persistence delegated to JSONStore/CSVStore module (backward compatibility)
    saveMeasurementCSV(objectName, mode, xlen, ylen, diagonal, area, percent, shapeType = null) {
        if (window?.CSVStore?.saveMeasurement) {
            if (window.CSVStore.setUnitSuffix) {
                window.CSVStore.setUnitSuffix(this.unitSuffix || 'mm');
            }
            return window.CSVStore.saveMeasurement(objectName, mode, xlen, ylen, diagonal, area, percent, shapeType);
        }

        // Fallback: immediate download of a simple JSON for this one object
        try {
            // Determine shape type from mode if not explicitly provided
            let finalShapeType = shapeType;
            if (!finalShapeType) {
                if (mode.includes('circle') || mode === 'manual_circle') {
                    finalShapeType = 'circular';
                } else {
                    finalShapeType = 'rectangular';
                }
            }

            const measurement = {
                timestamp: new Date().toISOString(),
                objectName: objectName,
                mode: mode,
                shapeType: finalShapeType,
                x_len: parseFloat(xlen.toFixed(3)),
                y_len: parseFloat(ylen.toFixed(3)),
                diagonal: parseFloat(diagonal.toFixed(3)),
                area: parseFloat(area.toFixed(3)),
                percent: (typeof percent !== 'undefined' && percent !== null)
                    ? parseFloat(percent.toFixed(3))
                    : null,
                units: this.unitSuffix
            };

            const content = JSON.stringify([measurement], null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const filename = 'measurements.json';
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            if (window.Logger) {
                window.Logger.add(`JSON downloaded ${filename}`);
            }
        } catch (e) {
            console.warn('JSON fallback save error', e);
        }
    }

    // Save calibration to JSON file
    async saveCalibration() {
        if (!this.cal || Object.keys(this.cal).length === 0) {
            this.addLog('No calibration data to save.', 'warn');
            return;
        }

        const calData = JSON.stringify(this.cal, null, 2);
        const filename = 'calibration.json';

        try {
            if (this.saveDirHandle) {
                // Save to selected folder if available
                const fileHandle = await this.saveDirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(calData);
                await writable.close();
                this.addLog(`Calibration saved to ${filename}`);
            } else {
                // Fallback to download
                const blob = new Blob([calData], { type: 'application/json' });
                this.downloadBlob(blob, filename);
                this.addLog('Calibration saved (downloaded)');
            }
        } catch (e) {
            console.error('Error saving calibration:', e);
            this.addLog('Error saving calibration: ' + e.message, 'error');
        }
    }

    // Load calibration from JSON file
    loadCalibration(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const calData = JSON.parse(text);

                // Basic validation
                if (typeof calData === 'object' && calData !== null) {
                    this.cal = calData;
                    this.addLog('Calibration loaded successfully');

                    // Reset file input
                    event.target.value = '';
                } else {
                    throw new Error('Invalid calibration data format');
                }
            } catch (err) {
                console.error('Error loading calibration:', err);
                this.addLog('Error loading calibration: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    async startCamera() {
        try {
            const select = this.getElement(ELEMENT_IDS.CAMERA_SELECT);
            const selectedId = select ? select.value : '';

            const videoConstraints = {
                width: { ideal: this.width },
                height: { ideal: this.height }
            };

            if (selectedId) {
                videoConstraints.deviceId = { exact: selectedId };
            } else {
                videoConstraints.facingMode = 'environment';
            }

            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            } catch (err) {
                this.addLog('Requested camera failed, falling back to default: ' + (err?.message || err), 'warn');
                this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }

            this.video.srcObject = this.stream;
            this.video.onloadedmetadata = () => {
                this.onVideoReady();
            };
        } catch (err) {
            alert('Error accessing camera: ' + err.message);
        }
    }

    onVideoReady() {
        // Update dimensions from video
        this.width = this.video.videoWidth;
        this.height = this.video.videoHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Calculate center and dimensions
        this.cx = Math.floor(this.width / 2);
        this.cy = Math.floor(this.height / 2);
        this.dm = Math.hypot(this.cx, this.cy);
        this.area = this.width * this.height;

        // Initialize OpenCV matrices
        this.src = new cv.Mat(this.height, this.width, cv.CV_8UC4);
        this.dst = new cv.Mat(this.height, this.width, cv.CV_8UC4);
        this.gray = new cv.Mat();
        this.blurred = new cv.Mat();

        // Initialize shadow removal if available
        if (window.ShadowRemoval) {
            window.ShadowRemoval.initializeMats(this.width, this.height);
        }
        this.thresh = new cv.Mat();

        // Initialize calibration
        this.initCalibration();

        // Hide start button
        const startBtn = this.getElement(ELEMENT_IDS.START_BTN);
        if (startBtn) {
            startBtn.style.display = 'none';
        }

        // Start animation loop
        this.animate();
    }

    initCalibration() {
        for (let x = 0; x <= this.dm; x += this.pixelBase) {
            this.cal[x] = this.calRange / this.dm;
        }
    }

    baseround(x, base = 1) {
        return Math.round(x / base) * base;
    }

    distance(x1, y1, x2, y2) {
        return Math.hypot(x1 - x2, y1 - y2);
    }

    conv(x, y) {
        const d = this.distance(0, 0, x, y);
        const rounded = this.baseround(d, this.pixelBase);
        const scale = this.cal[rounded] || this.cal[this.pixelBase];
        return { x: x * scale, y: y * scale };
    }

    calUpdate(x, y, unitDistance) {
        const pixelDistance = Math.hypot(x, y);
        const scale = Math.abs(unitDistance / pixelDistance);
        const target = this.baseround(Math.abs(pixelDistance), this.pixelBase);

        const low = target * scale - (this.calBase / 2);
        const high = target * scale + (this.calBase / 2);

        let start = unitDistance <= this.calBase ? 0 : target;
        while (start > 0 && start * scale > low) {
            start -= this.pixelBase;
        }

        let stop = target;
        const maxKey = Math.max(...Object.keys(this.cal).map(Number));

        if (unitDistance < this.baseround(this.calRange, this.pixelBase)) {
            while (stop * scale < high) {
                stop += this.pixelBase;
            }
        } else {
            stop = maxKey;
        }

        for (let px = start; px <= stop; px += this.pixelBase) {
            this.cal[px] = scale;
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.mouseRaw = { x, y };

        const ox = x - this.cx;
        const oy = (y - this.cy) * -1;

        if (this.keyFlags.percent) {
            const oldPercent = this.autoPercent;
            this.autoPercent = 5 * (x / this.width) * (y / this.height);
            // Log only when change is significant
            if (Math.abs(oldPercent - this.autoPercent) > 0.05) {
                this.addLog(`Auto percent: ${this.autoPercent.toFixed(2)}%`, 'debug');
            }
        } else if (this.keyFlags.thresh) {
            const oldThreshold = this.autoThreshold;
            const oldBlur = this.autoBlur;
            this.autoThreshold = Math.floor(255 * x / this.width);
            this.autoBlur = (Math.floor(20 * y / this.height) | 1) || 1;
            if (this.autoBlur % 2 === 0) {
                this.autoBlur += 1;
            }
            // Log when values change
            if (oldThreshold !== this.autoThreshold || oldBlur !== this.autoBlur) {
                this.addLog(`Threshold: ${this.autoThreshold}, Blur: ${this.autoBlur}`, 'debug');
            }
        } else if (this.keyFlags.norms) {
            const oldAlpha = this.normAlpha;
            const oldBeta = this.normBeta;
            this.normAlpha = Math.floor(64 * x / this.width);
            this.normBeta = Math.min(255, Math.floor(128 + (128 * y / this.height)));
            // Log when values change
            if (oldAlpha !== this.normAlpha || oldBeta !== this.normBeta) {
                this.addLog(`Normalize - Alpha: ${this.normAlpha}, Beta: ${this.normBeta}`, 'debug');
            }
        }

        // Update mouse position for circle mode when right button is held
        if (this.rightMouseDown && this.keyFlags.circleMode) {
            this.mouseNow = { x: ox, y: oy };
        } else if (!this.keyFlags.lock) {
            this.mouseNow = { x: ox, y: oy };
        }
    }

    handleMouseClick(e) {
        // Only handle left mouse button clicks
        if (e.button === 2) {
            return; // Right button is handled by handleMouseDown/Up
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ox = x - this.cx;
        const oy = (y - this.cy) * -1;

        // Reset circle mode if it was activated by right click
        if (this.keyFlags.circleMode && !this.rightMouseDown) {
            this.keyFlags.circleMode = false;
        }

        if (this.keyFlags.config) {
            this.keyFlags.lock = false;
            this.mouseMark = { x: ox, y: oy };
        } else if (this.keyFlags.auto || this.keyFlags.percent || this.keyFlags.thresh || this.keyFlags.norms) {
            this.keyFlags.percent = false;
            this.keyFlags.thresh = false;
            this.keyFlags.norms = false;
            this.keyFlags.lock = false;
            this.mouseMark = { x: ox, y: oy };
        } else if (!this.keyFlags.lock) {
            if (this.mouseMark) {
                this.keyFlags.lock = true;
            } else {
                this.mouseMark = { x: ox, y: oy };
            }
        } else {
            this.keyFlags.lock = false;
            this.mouseNow = { x: ox, y: oy };
            this.mouseMark = { x: ox, y: oy };
        }
    }

    handleRightClick(e) {
        // In manual mode (not auto mode), start circle selection
        if (!this.keyFlags.auto && !this.keyFlags.config &&
            !this.keyFlags.percent && !this.keyFlags.thresh && !this.keyFlags.norms) {
            // Start circle mode selection
            // Use mouseRaw if event is not available (contextmenu)
            const rect = this.canvas.getBoundingClientRect();
            const x = e ? (e.clientX - rect.left) : this.mouseRaw.x;
            const y = e ? (e.clientY - rect.top) : this.mouseRaw.y;
            const ox = x - this.cx;
            const oy = (y - this.cy) * -1;

            this.keyFlags.circleMode = true;
            this.mouseMark = { x: ox, y: oy };
            this.rightMouseDown = true;
        } else {
            // In other modes, clear as before
            this.clearKeyFlags();
            this.mouseMark = null;
            this.rightMouseDown = false;
        }
    }

    handleMouseDown(e) {
        // Handle right mouse button down for circle selection
        if (e.button === 2) { // Right mouse button
            if (!this.keyFlags.auto && !this.keyFlags.config &&
                !this.keyFlags.percent && !this.keyFlags.thresh && !this.keyFlags.norms) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const ox = x - this.cx;
                const oy = (y - this.cy) * -1;

                // Reset previous circle selection if any
                if (this.keyFlags.circleMode && !this.rightMouseDown) {
                    this.keyFlags.lock = false;
                }

                this.keyFlags.circleMode = true;
                this.mouseMark = { x: ox, y: oy };
                this.rightMouseDown = true;
            }
        }
    }

    handleMouseUp(e) {
        // Handle right mouse button up for circle selection
        if (e.button === 2) { // Right mouse button
            if (this.rightMouseDown && this.keyFlags.circleMode) {
                // Complete the circle measurement when right button is released
                // Don't set lock, so user can continue with other measurements
                this.rightMouseDown = false;
            }
        }
    }

    handleKeyPress(e) {
        // Skip if focused on input element
        try {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
                return;
            }
        } catch (err) {
            console.warn('Failed to check active element:', err);
        }

        let key = '';
        if (e?.code && KEY_CODE_MAP[e.code]) {
            key = KEY_CODE_MAP[e.code];
        } else if (e?.key) {
            key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
        }

        if (window?.Logger?.add) {
            window.Logger.add(`KEY press: ${key}`, 'debug');
        }

        // Handle key actions
        if (key === 'q' || key === 'escape') {
            this.stop();
        } else if (key === 'c') {
            this.keyFlags.config = !this.keyFlags.config;
            if (this.keyFlags.config) {
                this.clearKeyFlags();
                this.keyFlags.config = true;
                this.calLast = 0;
                this.mouseMark = null;
            }
        } else if (key === 'n') {
            this.keyFlags.norms = !this.keyFlags.norms;
            if (this.keyFlags.norms) {
                this.keyFlags.thresh = false;
                this.keyFlags.percent = false;
                this.keyFlags.lock = false;
                this.mouseMark = null;
                this._normalizeLogged = false; // Reset for logging on mode entry
                this.addLog(`Normalize mode: ON (Alpha: ${this.normAlpha}, Beta: ${this.normBeta})`);
            } else {
                this.addLog(`Normalize mode: OFF (Final Alpha: ${this.normAlpha}, Beta: ${this.normBeta})`);
            }
        } else if (key === 'r') {
            this.keyFlags.rotate = !this.keyFlags.rotate;
        } else if (key === 'a') {
            this.keyFlags.auto = !this.keyFlags.auto;
            if (this.keyFlags.auto) {
                this.clearKeyFlags();
                this.keyFlags.auto = true;
                this.mouseMark = null;
            }
        } else if (key === 'p') {
            this.keyFlags.percent = !this.keyFlags.percent;
            this.keyFlags.thresh = false;
            this.keyFlags.lock = false;
            if (this.keyFlags.percent) {
                this.addLog(`Percent adjustment mode: ON (current: ${this.autoPercent.toFixed(2)}%)`);
            } else {
                this.addLog(`Percent adjustment mode: OFF (final: ${this.autoPercent.toFixed(2)}%)`);
            }
        } else if (key === 't') {
            this.keyFlags.thresh = !this.keyFlags.thresh;
            this.keyFlags.percent = false;
            this.keyFlags.lock = false;
            if (this.keyFlags.thresh) {
                this.addLog(`Threshold adjustment mode: ON (Thresh: ${this.autoThreshold}, Blur: ${this.autoBlur})`);
            } else {
                this.addLog(`Threshold adjustment mode: OFF (Final Thresh: ${this.autoThreshold}, Blur: ${this.autoBlur})`);
            }
        }

        if (window?.Logger?.add) {
            window.Logger.add(`KEY state: ${JSON.stringify(this.keyFlags)}`, 'debug');
        }
    }

    handleControlAction(action) {
        if (this.menu?.handleControlAction) {
            return this.menu.handleControlAction(action);
        }
        console.warn('Menu module not loaded; control action ignored:', action);
    }

    updateControlUI() {
        if (this.menu?.updateControlUI) {
            return this.menu.updateControlUI();
        }
    }

    clearKeyFlags() {
        for (let key in this.keyFlags) {
            if (key !== 'rotate') {
                this.keyFlags[key] = false;
            }
        }
        this.rightMouseDown = false;
    }

    drawText(text, x, y, options = {}) {
        const size = options.size || 16;
        const color = options.color || 'yellow';
        const center = options.center || false;
        const middle = options.middle || false;
        const top = options.top || false;
        const right = options.right || false;

        this.ctx.font = `${size}px monospace`;
        this.ctx.fillStyle = this.colors[color] || color;

        const metrics = this.ctx.measureText(text);
        const textHeight = size;

        if (center) {
            x -= metrics.width / 2;
        } else if (right) {
            x -= metrics.width;
        }

        if (top) {
            y += textHeight;
        } else if (middle) {
            y += textHeight / 2;
        }

        this.ctx.fillText(text, x, y);
    }

    drawLine(x1, y1, x2, y2, weight = 1, color = 'green') {
        this.ctx.strokeStyle = this.colors[color] || color;
        this.ctx.lineWidth = weight;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    drawRect(x1, y1, x2, y2, weight = 1, color = 'green') {
        this.ctx.strokeStyle = this.colors[color] || color;
        this.ctx.lineWidth = weight;
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    drawCrosshairs(offset = 10, weight = 1, color = 'green', invert = false) {
        const offsetPx = this.width * offset / 200;

        if (invert) {
            this.drawLine(0, this.cy, this.cx - offsetPx, this.cy, weight, color);
            this.drawLine(this.cx + offsetPx, this.cy, this.width, this.cy, weight, color);
            this.drawLine(this.cx, 0, this.cx, this.cy - offsetPx, weight, color);
            this.drawLine(this.cx, this.cy + offsetPx, this.cx, this.height, weight, color);
        } else {
            this.drawLine(this.cx - offsetPx, this.cy, this.cx + offsetPx, this.cy, weight, color);
            this.drawLine(this.cx, this.cy - offsetPx, this.cx, this.cy + offsetPx, weight, color);
        }
    }
    animate() {
        // Apply rotation BEFORE drawing anything
        if (this.keyFlags.rotate) {
            this.ctx.save();
            this.ctx.translate(this.width / 2, this.height / 2);
            this.ctx.rotate(Math.PI);
            this.ctx.translate(-this.width / 2, -this.height / 2);
        }

        this.ctx.drawImage(this.video, 0, 0, this.width, this.height);

        // Apply shadow removal if enabled
        if (this.shadowRemovalMode && window.ShadowRemoval && window.ShadowRemoval.isEnabled()) {
            try {
                const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
                this.src.data.set(imageData.data);
                window.ShadowRemoval.removeShadows(this.src, this.dst);
                const output = new ImageData(
                    new Uint8ClampedArray(this.dst.data),
                    this.width,
                    this.height
                );
                this.ctx.putImageData(output, 0, 0);
            } catch (e) {
                console.warn('Shadow removal processing failed:', e);
            }
        }

        if (this.binaryMode) {
            this.applyBinaryFilter();
        }

        // ArUco calibration block removed

        let infoText = `CAMERA: ${this.width}x${this.height}\n\n`;
        infoText += `LAST CLICK: ${this.mouseMark ? `(${this.mouseMark.x}, ${this.mouseMark.y}) PIXELS` : 'NONE'}\n`;
        infoText += `CURRENT XY: (${this.mouseNow.x}, ${this.mouseNow.y}) PIXELS\n`;

        if (this.keyFlags.norms) {
            this.processNormalizeMode(infoText);
        } else if (this.keyFlags.config) {
            this.processConfigMode(infoText);
        } else if (this.keyFlags.auto) {
            this.processAutoMode(infoText);
        } else {
            this.processDimensionMode(infoText);
        }

        infoText += `\nQ = QUIT\nR = ROTATE\nN = NORMALIZE\nA = AUTO-MODE\n`;
        infoText += `P = MIN-PERCENT\nT = THRESHOLD\n`;
        infoText += `C = CONFIG-MODE`;
        if (this.keyFlags.rotate) {
            infoText += `\n[ROTATED 180°]`;
        }

        this.info.textContent = infoText;

        // Restore context if rotated
        if (this.keyFlags.rotate) {
            this.ctx.restore();
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    applyBinaryFilter() {
        try {
            const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
            if (this.src && this.gray && this.thresh && this.dst) {
                this.src.data.set(imageData.data);
                cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);

                const t = typeof this.autoThreshold === 'number' ? this.autoThreshold : 127;
                cv.threshold(this.gray, this.thresh, t, 255, cv.THRESH_BINARY);
                cv.cvtColor(this.thresh, this.dst, cv.COLOR_GRAY2RGBA);

                const out = new ImageData(
                    new Uint8ClampedArray(this.dst.data),
                    this.width,
                    this.height
                );
                this.ctx.putImageData(out, 0, 0);
            }
        } catch (e) {
            console.warn('Binary conversion failed:', e);
        }
    }

    processNormalizeMode(infoText) {
        infoText += `\nNORMALIZE MODE\nALPHA (min): ${this.normAlpha}\nBETA (max): ${this.normBeta}`;

        // Actually apply normalization to the image
        try {
            const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
            if (this.src && this.dst) {
                this.src.data.set(imageData.data);

                // Apply OpenCV normalize - adjusts pixel values to range [alpha, beta]
                cv.normalize(this.src, this.dst, this.normAlpha, this.normBeta, cv.NORM_MINMAX);

                const output = new ImageData(
                    new Uint8ClampedArray(this.dst.data),
                    this.width,
                    this.height
                );
                this.ctx.putImageData(output, 0, 0);
            }
        } catch (e) {
            console.warn('Normalization failed:', e);
        }

        this.drawCrosshairs(5, 2, 'yellow');
    }

    processConfigMode(infoText) {
        this.drawCrosshairs(5, 2, 'red', true);
        this.drawLine(this.cx, this.cy, this.cx + this.cx, this.cy + this.cy, 1, 'red');
        this.drawLine(this.cx, this.cy, this.cx + this.cy, this.cy - this.cx, 1, 'red');
        this.drawLine(this.cx, this.cy, -this.cx + this.cx, -this.cy + this.cy, 1, 'red');
        this.drawLine(this.cx, this.cy, this.cx - this.cy, this.cy + this.cx, 1, 'red');

        infoText += `\nCONFIG MODE\n`;

        if (!this.calLast) {
            this.calLast = this.calBase;
        }

        if (this.calLast <= this.calRange) {
            if (this.mouseMark) {
                this.calUpdate(this.mouseMark.x, this.mouseMark.y, this.calLast);
                this.calLast += this.calBase;
                this.mouseMark = null;
            }
            this.drawText(`Click on D = ${this.calLast}`, this.cx + 100, this.cy + 30, { color: 'red' });
        } else {
            this.clearKeyFlags();
            this.calLast = null;
            this.drawText('CONFIG: Complete', this.cx + 100, this.cy + 30, { color: 'red' });
        }
    }

    processAutoMode(infoText) {
        this.mouseMark = null;
        infoText += `\nAUTO MODE\nUNITS: ${this.unitSuffix}\n`;
        infoText += `MIN PERCENT: ${this.autoPercent.toFixed(2)}\n`;
        infoText += `THRESHOLD: ${this.autoThreshold}\n`;
        infoText += `GAUSS BLUR: ${this.autoBlur}`;

        this.drawCrosshairs(5, 2, 'green');

        try {
            const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
            this.src.data.set(imageData.data);

            cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);
            const ksize = new cv.Size(this.autoBlur, this.autoBlur);
            cv.GaussianBlur(this.gray, this.blurred, ksize, 0, 0, cv.BORDER_DEFAULT);
            cv.threshold(this.blurred, this.thresh, this.autoThreshold, 255, cv.THRESH_BINARY);
            cv.bitwise_not(this.thresh, this.thresh);

            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            // Use RETR_TREE to find all contours including holes (internal contours)
            cv.findContours(this.thresh, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

            this.addLog(`=== AUTO MODE: Found ${contours.size()} contours ===`);

            let objectCount = 0;
            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);

                // Check hierarchy: hierarchy data is [next, previous, child, parent] for each contour
                // If parent >= 0, this is a hole (internal contour)
                // We want to process both external contours and holes
                // In OpenCV.js, hierarchy is accessed via data32S array: [next, prev, child, parent]
                const hierarchyIdx = i * 4;
                const parent = hierarchy.data32S[hierarchyIdx + 3];
                const isHole = parent >= 0; // Has a parent, so it's a hole

                const rect = cv.boundingRect(contour);

                const x1 = rect.x;
                const y1 = rect.y;
                const w = rect.width;
                const h = rect.height;
                const x2 = x1 + w;
                const y2 = y1 + h;
                const x3 = x1 + (w / 2);
                const y3 = y1 + (h / 2);

                const percent = 100 * w * h / this.area;
                if (percent < this.autoPercent || percent > DEFAULT_CONFIG.AUTO_PERCENT_MAX) {
                    continue;
                }

                objectCount++;

                const x1c = x1 - this.cx;
                const y1c = (y1 - this.cy) * -1;
                const x2c = x2 - this.cx;
                const y2c = (y2 - this.cy) * -1;

                const conv1 = this.conv(x1c, y1c);
                const conv2 = this.conv(x2c, y2c);

                const xlen = Math.abs(conv1.x - conv2.x);
                const ylen = Math.abs(conv1.y - conv2.y);
                const carea = xlen * ylen;

                // Detect if object is circular (aspect ratio close to 1:1)
                const ratio = Math.min(xlen, ylen) / Math.max(xlen, ylen);
                const isCircular = ratio >= 0.85; // Objects with ratio >= 0.85 are considered circular

                let alen = 0;
                let circleData = null;

                if (isCircular) {
                    // For circular objects, calculate enclosing circle
                    try {
                        circleData = cv.minEnclosingCircle(contour);
                        const circleCenterX = circleData.center.x;
                        const circleCenterY = circleData.center.y;
                        const circleRadius = circleData.radius;

                        // Convert circle center to calibrated coordinates
                        const centerXc = circleCenterX - this.cx;
                        const centerYc = (circleCenterY - this.cy) * -1;
                        const centerConv = this.conv(centerXc, centerYc);

                        // Convert radius to calibrated units
                        const rounded = this.baseround(circleRadius, this.pixelBase);
                        const scale = this.cal[rounded] || this.cal[this.pixelBase];
                        const radiusConv = circleRadius * Math.abs(scale);
                        alen = radiusConv * 2; // Diameter
                    } catch (e) {
                        console.warn('Failed to calculate minEnclosingCircle:', e);
                        // Fallback to average of width and height
                        alen = (xlen + ylen) / 2;
                    }
                } else if (ratio >= 0.95) {
                    // Nearly square but not quite circular
                    alen = (xlen + ylen) / 2;
                }

                const colorName = this.autoColors[objectCount % this.autoColors.length];

                this.logObjectMeasurement(objectCount, x1, y1, xlen, ylen, carea, alen, percent, colorName, isCircular);

                // Persist measurement to JSON
                try {
                    const objectName = `obj${objectCount}`;
                    const diagLen = Math.hypot(xlen, ylen);
                    const shapeType = isCircular ? 'circular' : 'rectangular';
                    this.saveMeasurementCSV(objectName, 'auto', xlen, ylen, diagLen, carea, percent, shapeType);
                } catch (e) {
                    console.warn('JSON save failed:', e);
                }

                this.drawObjectAnnotations(x1, y1, x2, y2, x3, y3, w, h, xlen, ylen, carea, alen, colorName, isCircular, circleData);

                // Auto-save image if enabled
                if (this.autoSave) {
                    this.saveObjectImage(x1, y1, w, h, objectCount);
                }
            }

            this.addLog(`Total objects detected: ${objectCount}`);
            contours.delete();
            hierarchy.delete();
        } catch (err) {
            console.error('Error in auto mode:', err);
        }
    }

    // Helper: Log object measurement details
    logObjectMeasurement(objectCount, x1, y1, xlen, ylen, carea, alen, percent, colorName, isCircular = false) {
        this.addLog(`Object #${objectCount}:`, 'info');

        if (isCircular) {
            this.addLog(`  Type: CIRCULAR`, 'info');
            if (alen) {
                this.addLog(`  Diameter: ${alen.toFixed(2)}${this.unitSuffix}`, 'info');
            }
        } else {
            this.addLog(`  Type: RECTANGULAR`, 'info');
            this.addLog(`  Width: ${xlen.toFixed(2)}${this.unitSuffix}`, 'info');
            this.addLog(`  Height: ${ylen.toFixed(2)}${this.unitSuffix}`, 'info');
        }

        this.addLog(`  Area: ${carea.toFixed(2)}${this.unitSuffix}²`, 'info');
        if (alen && !isCircular) {
            this.addLog(`  Avg: ${alen.toFixed(2)}${this.unitSuffix}`, 'info');
        }
        this.addLog(`  Percent: ${percent.toFixed(2)}%`, 'info');
        this.addLog(`  Color: ${colorName}`, 'info');
    }

    drawObjectAnnotations(x1, y1, x2, y2, x3, y3, w, h, xlen, ylen, carea, alen, colorName, isCircular = false, circleData = null) {
        if (isCircular && circleData) {
            // Draw circle for circular objects
            const centerX = circleData.center.x;
            const centerY = circleData.center.y;
            const radius = circleData.radius;

            this.ctx.strokeStyle = this.colors[colorName] || colorName;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            this.ctx.stroke();

            // Display diameter above the circle
            if (alen) {
                this.drawText(
                    `⌀ ${alen.toFixed(2)}`,
                    centerX,
                    centerY - radius - 8,
                    { color: colorName, center: true }
                );
            }

            // Display area below the circle
            this.drawText(
                `Area: ${carea.toFixed(2)}`,
                centerX,
                centerY + radius + 8,
                { color: colorName, center: true, top: true }
            );
        } else {
            // Draw rectangle for rectangular objects
            this.drawRect(x1, y1, x2, y2, 2, colorName);
            this.drawText(
                `${xlen.toFixed(2)}`,
                x1 + w / 2,
                Math.min(y1, y2) - 8,
                { color: colorName, center: true }
            );
            this.drawText(
                `Area: ${carea.toFixed(2)}`,
                x3,
                y2 + 8,
                { color: colorName, center: true, top: true }
            );
            if (alen) {
                this.drawText(
                    `Avg: ${alen.toFixed(2)}`,
                    x3,
                    y2 + 34,
                    { color: colorName, center: true, top: true }
                );
            }
            if (x1 < this.width - x2) {
                this.drawText(
                    `${ylen.toFixed(2)}`,
                    x2 + 4,
                    (y1 + y2) / 2,
                    { color: colorName, middle: true }
                );
            } else {
                this.drawText(
                    `${ylen.toFixed(2)}`,
                    x1 - 4,
                    (y1 + y2) / 2,
                    { color: colorName, middle: true, right: true }
                );
            }
        }
    }

    async saveObjectImage(x1, y1, w, h, objectCount) {
        try {
            const sx = x1;
            const sy = y1;
            const sw = Math.max(1, w);
            const sh = Math.max(1, h);

            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = sw;
            cropCanvas.height = sh;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(this.canvas, sx, sy, sw, sh, 0, 0, sw, sh);

            const objectName = `obj${objectCount}`;
            const mode = 'auto';
            const now = new Date();

            const pad = (n, z = 2) => n.toString().padStart(z, '0');
            const fnameTime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
            const filename = `${objectName}_${mode}_${fnameTime}.jpg`;

            cropCanvas.toBlob(async (blob) => {
                if (!blob) return;

                if (this.saveDirHandle?.getFileHandle) {
                    try {
                        const fileHandle = await this.saveDirHandle.getFileHandle(filename, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        this.addLog(`Saved ${filename} to chosen folder`);
                    } catch (e) {
                        this.addLog(
                            'Failed to save to directory handle, falling back to download: ' + (e?.message || e),
                            'warn'
                        );
                        this.downloadBlob(blob, filename);
                    }
                } else {
                    this.downloadBlob(blob, filename);
                    this.addLog(`Downloaded ${filename}`);
                }
            }, 'image/jpeg', DEFAULT_CONFIG.JPEG_QUALITY);
        } catch (e) {
            this.addLog('Error while auto-saving object: ' + (e?.message || e), 'error');
        }
    }

    downloadBlob(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    }

    processDimensionMode(infoText) {
        this.drawCrosshairs(5, 2, 'green');
        this.drawLine(this.mouseRaw.x, 0, this.mouseRaw.x, this.height, 1, 'green');
        this.drawLine(0, this.mouseRaw.y, this.width, this.mouseRaw.y, 1, 'green');

        if (this.mouseMark) {
            const x1 = this.mouseMark.x;
            const y1 = this.mouseMark.y;
            const x2 = this.mouseNow.x;
            const y2 = this.mouseNow.y;

            const conv1 = this.conv(x1, y1);
            const conv2 = this.conv(x2, y2);

            // Standard rectangular calculations
            const xlen = Math.abs(conv1.x - conv2.x);
            const ylen = Math.abs(conv1.y - conv2.y);
            const llen = Math.hypot(xlen, ylen);
            const rectArea = xlen * ylen;

            let alen = 0;
            const ratio = Math.min(xlen, ylen) / Math.max(xlen, ylen);
            if (ratio >= 0.95) {
                alen = (xlen + ylen) / 2;
            }

            // Circle mode calculations (Center-to-Radius)
            let radius = 0;
            let diameter = 0;
            let circleArea = 0;

            if (this.keyFlags.circleMode) {
                // Distance from center (mouseMark) to current point (mouseNow) is the radius
                radius = llen; // llen is the hypotenuse distance between points
                diameter = radius * 2;
                circleArea = Math.PI * (radius * radius);
            }

            this.addLog('=== MANUAL MEASUREMENT ===');
            if (this.keyFlags.circleMode) {
                this.addLog(`Mode: CIRCLE (Center -> Radius)`);
                this.addLog(`Radius: ${radius.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Diameter: ${diameter.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Area: ${circleArea.toFixed(2)}${this.unitSuffix}²`);
            } else {
                this.addLog(`Mode: RECTANGLE`);
                this.addLog(`X Length: ${xlen.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Y Length: ${ylen.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Diagonal: ${llen.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Area: ${rectArea.toFixed(2)}${this.unitSuffix}²`);
                if (alen) {
                    this.addLog(`Average (square): ${alen.toFixed(2)}${this.unitSuffix}`);
                }
            }
            this.addLog(`Pixel coords: (${x1}, ${y1}) to (${x2}, ${y2})`);
            this.addLog('===========================');

            // Persist manual measurement to JSON
            try {
                const objectName = (this.getElement(ELEMENT_IDS.OBJECT_NAME)?.value?.trim()) || 'manual';
                if (this.keyFlags.circleMode) {
                    // For circle, save diameter as diagonal/length
                    this.saveMeasurementCSV(objectName, 'manual_circle', diameter, diameter, diameter, circleArea, null, 'circular');
                } else {
                    this.saveMeasurementCSV(objectName, 'manual_rect', xlen, ylen, llen, rectArea, null, 'rectangular');
                }
            } catch (e) {
                console.warn('Manual measurement JSON save failed:', e);
            }

            if (this.keyFlags.circleMode) {
                // Circle mode display
                infoText += `\nMODE: CIRCLE\n`;
                infoText += `RADIUS: ${radius.toFixed(2)}${this.unitSuffix}\n`;
                infoText += `DIAMETER: ${diameter.toFixed(2)}${this.unitSuffix}`;
            } else {
                // Rectangle mode display
                infoText += `\nX LEN: ${xlen.toFixed(2)}${this.unitSuffix}\n`;
                infoText += `Y LEN: ${ylen.toFixed(2)}${this.unitSuffix}\n`;
                infoText += `L LEN: ${llen.toFixed(2)}${this.unitSuffix}`;
            }

            const px1 = x1 + this.cx;
            const px2 = x2 + this.cx;
            const py1 = -y1 + this.cy;
            const py2 = -y2 + this.cy;
            const px3 = px1 + ((px2 - px1) / 2);
            const py3 = Math.max(py1, py2);

            const weight = this.keyFlags.lock ? 2 : 1;

            if (this.keyFlags.circleMode) {
                // Draw circle from center (px1, py1) with radius
                // Calculate pixel radius
                const pixelRadius = Math.hypot(px2 - px1, py2 - py1);

                this.ctx.strokeStyle = this.colors['red'];
                this.ctx.lineWidth = weight;
                this.ctx.beginPath();
                this.ctx.arc(px1, py1, pixelRadius, 0, 2 * Math.PI);
                this.ctx.stroke();

                // Draw radius line
                this.drawLine(px1, py1, px2, py2, weight, 'green');

                // Draw center point
                this.drawCrosshairs(3, 2, 'red', false); // Optional: highlight center

                // Display diameter/radius
                this.drawText(
                    `R: ${radius.toFixed(2)}`,
                    (px1 + px2) / 2,
                    (py1 + py2) / 2 - 8,
                    { color: 'green', center: true }
                );
                this.drawText(
                    `⌀ ${diameter.toFixed(2)}`,
                    px1,
                    py1 - pixelRadius - 8,
                    { color: 'red', center: true }
                );
                this.drawText(
                    `Area: ${circleArea.toFixed(2)}`,
                    px1,
                    py1 + pixelRadius + 16,
                    { color: 'red', center: true }
                );
            } else {
                // Draw rectangle (original behavior)
                this.drawRect(px1, py1, px2, py2, weight, 'red');
                this.drawLine(px1, py1, px2, py2, weight, 'green');

                this.drawText(
                    `${xlen.toFixed(2)}`,
                    px1 - ((px1 - px2) / 2),
                    Math.min(py1, py2) - 8,
                    { color: 'red', center: true }
                );
                this.drawText(
                    `Area: ${rectArea.toFixed(2)}`,
                    px3,
                    py3 + 8,
                    { color: 'red', center: true, top: true }
                );
                if (alen) {
                    this.drawText(
                        `Avg: ${alen.toFixed(2)}`,
                        px3,
                        py3 + 34,
                        { color: 'green', center: true, top: true }
                    );
                }

                if (px2 <= px1) {
                    this.drawText(
                        `${ylen.toFixed(2)}`,
                        px1 + 4,
                        (py1 + py2) / 2,
                        { color: 'red', middle: true }
                    );
                    this.drawText(
                        `${llen.toFixed(2)}`,
                        px2 - 4,
                        py2 - 4,
                        { color: 'green', right: true }
                    );
                } else {
                    this.drawText(
                        `${ylen.toFixed(2)}`,
                        px1 - 4,
                        (py1 + py2) / 2,
                        { color: 'red', middle: true, right: true }
                    );
                    this.drawText(
                        `${llen.toFixed(2)}`,
                        px2 + 8,
                        py2 - 4,
                        { color: 'green' }
                    );
                }
            }
        }
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.stream) {
            try {
                const tracks = this.stream.getTracks();
                tracks.forEach(t => t.stop());
            } catch (e) {
                console.warn('Error stopping stream tracks', e);
            }
            this.stream = null;
        }

        try {
            if (this.src) this.src.delete();
            if (this.dst) this.dst.delete();
            if (this.gray) this.gray.delete();
            if (this.blurred) this.blurred.delete();
            if (this.thresh) this.thresh.delete();

            // Cleanup shadow removal resources
            if (window.ShadowRemoval) {
                window.ShadowRemoval.cleanupMats();
            }
        } catch (e) {
            console.warn('Error releasing OpenCV mats', e);
        }

        const startBtn = this.getElement(ELEMENT_IDS.START_BTN);
        if (startBtn) {
            startBtn.style.display = 'block';
            startBtn.disabled = !(typeof cvReady !== 'undefined' && cvReady);
        }
    }
}

// Expose CamRuler globally
window.CamRuler = CamRuler;
