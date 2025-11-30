
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
    CALIBRATION_FILE: 'calibrationFile',
    CALIBRATION_LOAD_BTN: 'calibrationLoadBtn',
    CALIBRATION_STATUS: 'calibrationStatus'
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
    AUTO_PERCENT_MAX: 60
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
        this.video = document.getElementById(ELEMENT_IDS.VIDEO);
        this.canvas = document.getElementById(ELEMENT_IDS.CANVAS);
        this.ctx = this.canvas.getContext('2d');
        this.info = document.getElementById(ELEMENT_IDS.INFO);

        this.width = DEFAULT_CONFIG.WIDTH;
        this.height = DEFAULT_CONFIG.HEIGHT;
        this.stream = null;
        this.animationId = null;

        this.src = null;
        this.dst = null;
        this.gray = null;
        this.thresh = null;

        this.pixelBase = DEFAULT_CONFIG.PIXEL_BASE;
        this.calRange = DEFAULT_CONFIG.CAL_RANGE;
        this.calBase = DEFAULT_CONFIG.CAL_BASE;
        this.cal = {};
        this.unitSuffix = DEFAULT_CONFIG.UNIT_SUFFIX;
        this.calibrationMode = 'manual';
        this.manualCalibration = {};

        this.mouseMark = null;

        this.keyFlags = {
            config: false,
            auto: false,
            percent: false,
            norms: false,
            rotate: false,
            lock: false,
            circleMode: false
        };

        this.autoPercent = DEFAULT_CONFIG.AUTO_PERCENT;
        this.autoThreshold = DEFAULT_CONFIG.AUTO_THRESHOLD;
        this.autoBlur = DEFAULT_CONFIG.AUTO_BLUR;
        this.normAlpha = DEFAULT_CONFIG.NORM_ALPHA;
        this.normBeta = DEFAULT_CONFIG.NORM_BETA;

        this.colors = COLOR_PALETTE;
        this.autoColors = AUTO_COLOR_SEQUENCE;

        this.cx = 0;
        this.cy = 0;
        this.dm = 0;

        this.logBuffer = [];
        this.maxLogs = DEFAULT_CONFIG.MAX_LOGS;
        this.logEl = null;
        this.binaryMode = false;
        this.shadowRemovalMode = false;

        this.autoSave = false;
        this.saveDirHandle = null;

        try {
            if (window?.Menu) {
                this.menu = new window.Menu(this);
            }
            if (window?.CSVStore?.setUnitSuffix) {
                window.CSVStore.setUnitSuffix(this.unitSuffix);
            }
        } catch (e) {
            console.warn('Помилка ініціалізації модулів:', e);
        }
    }

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
                    alert('OpenCV.js ще завантажується. Будь ласка, зачекайте...');
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
                this.addLog(`Вибрано камеру: ${val}`);
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

                    try {
                        if (this.menu?.handleControlAction) {
                            this.menu.handleControlAction(action);
                        } else if (typeof this.handleControlAction === 'function') {
                            this.handleControlAction(action);
                        }
                    } catch (e) {
                        console.warn('Control action failed:', e);
                    }

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
                                console.warn('Помилка оновлення UI:', e);
                            }
                        }
                    } catch (e) {
                        console.warn('Помилка синтезу події клавіатури:', e);
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
                this.addLog('Автозбереження ' + (this.autoSave ? 'увімкнено' : 'вимкнено'));
            });
        }

        if (chooseFolderBtn) {
            chooseFolderBtn.addEventListener('click', async () => {
                await this.handleFolderSelection(saveFolderLabel);
            });
        }

        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', async () => {
                if (window.CSVStore) {
                    try {
                        await window.CSVStore.exportAll();
                    } catch (e) {
                        this.addLog('Export failed: ' + (e?.message || e), 'error');
                        console.error('Export error:', e);
                    }
                }
            });
        }
    }

    async handleFolderSelection(saveFolderLabel) {
        try {
            if (!window.showDirectoryPicker) {
                this.addLog('File System Access API недоступний, файли буде завантажено', 'warn');
                if (saveFolderLabel) {
                    saveFolderLabel.textContent = '(downloads)';
                }
                return;
            }

            const handle = await window.showDirectoryPicker();

            try {
                const imgsHandle = await handle.getDirectoryHandle('imgs', { create: true });
                this.saveDirHandle = imgsHandle;
                if (window.CSVStore) {
                    window.CSVStore.saveDirHandle = imgsHandle;
                }
                this.addLog('Папку для збереження встановлено: imgs (у вибраній директорії)');
                if (saveFolderLabel) {
                    saveFolderLabel.textContent = 'imgs (chosen dir)';
                }
            } catch (e) {
                this.saveDirHandle = handle;
                if (window.CSVStore) {
                    window.CSVStore.saveDirHandle = handle;
                }
                this.addLog('Папку для збереження встановлено: вибрана директорія');
                if (saveFolderLabel) {
                    saveFolderLabel.textContent = '(chosen directory)';
                }
            }
        } catch (err) {
                this.addLog(
                    'Вибір папки скасовано або сталася помилка: ' + (err?.message || err),
                    'warn'
                );
        }
    }

    setupFooterControls() {
        const footerEl = this.getElement(ELEMENT_IDS.APP_FOOTER);
        const footerToggle = this.getElement(ELEMENT_IDS.FOOTER_TOGGLE);

        try {
            if (footerEl) {
                const collapsed = localStorage.getItem('footer_collapsed') === '1';
                if (collapsed) {
                    footerEl.classList.add('collapsed');
                }
            }

            if (footerToggle && footerEl) {
                footerToggle.addEventListener('click', () => {
                    const nowCollapsed = footerEl.classList.toggle('collapsed');
                    try {
                        localStorage.setItem('footer_collapsed', nowCollapsed ? '1' : '0');
                    } catch (e) {
                        console.warn('Не вдалося зберегти стан футера:', e);
                    }
                });
            }
        } catch (e) {
            console.warn('Помилка налаштування футера:', e);
        }
    }

    setupDebugLogging() {
        const debugToggleBtn = this.getElement(ELEMENT_IDS.DEBUG_TOGGLE);
        const binaryToggleBtn = this.getElement(ELEMENT_IDS.BINARY_TOGGLE);
        const shadowToggleBtn = this.getElement(ELEMENT_IDS.SHADOW_TOGGLE);


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

    setupCalibrationControls() {
        const calibrationFile = this.getElement(ELEMENT_IDS.CALIBRATION_FILE);
        const calibrationLoadBtn = this.getElement(ELEMENT_IDS.CALIBRATION_LOAD_BTN);
        const calibrationStatus = this.getElement(ELEMENT_IDS.CALIBRATION_STATUS);
        const switchToJsonBtn = document.getElementById('switchToJsonBtn');
        const switchToManualBtn = document.getElementById('switchToManualBtn');

        this.addLog('Setting up calibration controls...');

        if (calibrationLoadBtn) {
            calibrationLoadBtn.addEventListener('click', async () => {
                console.log('Load calibration button clicked');
                this.addLog('Load calibration button clicked');
                
                if (!calibrationFile?.files?.length) {
                    this.addLog('Please select a calibration file', 'warn');
                    return;
                }

                const file = calibrationFile.files[0];
                this.addLog(`Loading calibration file: ${file.name}`);
                const success = await window.CalibrationManager.loadFromFile(file);

                if (success) {
                    this.addLog('Calibration file loaded successfully');
                    this.updateCalibrationFromManager();
                    if (calibrationStatus) {
                        calibrationStatus.textContent = window.CalibrationManager.getStatus();
                    }
                    if (switchToJsonBtn && switchToManualBtn) {
                        switchToJsonBtn.classList.remove('hidden-btn');
                        switchToManualBtn.classList.remove('hidden-btn');
                    }
                } else {
                    this.addLog('Failed to load calibration file', 'error');
                }
            });
        } else {
            this.addLog('Calibration load button not found in DOM', 'warn');
        }

        if (switchToJsonBtn) {
            switchToJsonBtn.addEventListener('click', () => {
                this.switchToJsonCalibration();
            });
        }
        
        if (switchToManualBtn) {
            switchToManualBtn.addEventListener('click', () => {
                this.switchToManualCalibration();
            });
        }


        if (calibrationStatus && window?.CalibrationManager?.isLoaded) {
            calibrationStatus.textContent = window.CalibrationManager.getStatus();
        }
    }

    updateCalibrationFromManager() {
        if (!window?.CalibrationManager?.isLoaded || !window.CalibrationManager.pixelsPerMm) {
            this.addLog('Calibration not loaded or invalid', 'warn');
            return;
        }

        const pixelsPerMm = window.CalibrationManager.pixelsPerMm;
        this.pixelBase = Math.max(1, Math.round(pixelsPerMm));

        const jsonCal = {};
        for (let pixelDist = this.pixelBase; pixelDist <= this.calRange * this.pixelBase; pixelDist += this.pixelBase) {
            jsonCal[pixelDist] = pixelDist / pixelsPerMm;
        }

        this.storedJsonCalibration = jsonCal;
        this.calibrationMode = 'json';
        this.cal = JSON.parse(JSON.stringify(jsonCal));

        const squareSizePixels = 12 * pixelsPerMm;
        const msg = `✓ JSON Calibration: ${pixelsPerMm.toFixed(4)} px/mm, scale factor: ${(1/pixelsPerMm).toFixed(6)} mm/px`;
        this.addLog(msg);
        console.log(msg);
        console.log(`Debug: 12mm should be ${squareSizePixels.toFixed(2)} pixels`);
        console.log(`Debug: ${squareSizePixels.toFixed(1)}px / ${pixelsPerMm.toFixed(4)} = ${(squareSizePixels / pixelsPerMm).toFixed(2)}mm`);
        console.log('cal table sample:', { cal_3: jsonCal[3], cal_6: jsonCal[6], cal_36: jsonCal[36] });

        this.updateCalibrationUI();
    }

    switchToManualCalibration() {
        this.calibrationMode = 'manual';
        this.cal = JSON.parse(JSON.stringify(this.manualCalibration || {}));
        
        if (Object.keys(this.cal).length === 0) {
            this.initCalibration();
        }
        
        const msg = `✓ Switched to manual calibration`;
        this.addLog(msg);
        console.log(msg);
        this.updateCalibrationUI();
    }

    switchToJsonCalibration() {
        if (!this.storedJsonCalibration) {
            this.addLog('No JSON calibration stored', 'warn');
            return;
        }
        
        this.calibrationMode = 'json';
        this.cal = JSON.parse(JSON.stringify(this.storedJsonCalibration));
        
        const msg = `✓ Switched to JSON calibration`;
        this.addLog(msg);
        console.log(msg);
        this.updateCalibrationUI();
    }

    updateCalibrationUI() {
        const modeIndicator = document.getElementById('calibrationModeIndicator');
        if (modeIndicator) {
            modeIndicator.textContent = `Mode: ${this.calibrationMode === 'json' ? 'JSON' : 'Manual'}`;
            modeIndicator.style.color = this.calibrationMode === 'json' ? '#4CAF50' : '#FFC107';
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

    saveMeasurementCSV(objectName, mode, xlen, ylen, diagonal, area, percent, shapeType = null) {
        if (window?.CSVStore?.saveMeasurement) {
            if (window.CSVStore.setUnitSuffix) {
                window.CSVStore.setUnitSuffix(this.unitSuffix || 'mm');
            }
            return window.CSVStore.saveMeasurement(objectName, mode, xlen, ylen, diagonal, area, percent, shapeType);
        }

        try {
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
                window.Logger.add(`JSON завантажено ${filename}`);
            }
        } catch (e) {
            console.warn('Помилка збереження JSON', e);
        }
    }

    async saveCalibration() {
        if (!this.cal || Object.keys(this.cal).length === 0) {
            this.addLog('No calibration data to save.', 'warn');
            return;
        }

        const calData = JSON.stringify(this.cal, null, 2);
        const filename = 'calibration.json';

        try {
            if (this.saveDirHandle) {
                const fileHandle = await this.saveDirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(calData);
                await writable.close();
                this.addLog(`Калібрування збережено у ${filename}`);
            } else {
                const blob = new Blob([calData], { type: 'application/json' });
                this.downloadBlob(blob, filename);
                this.addLog('Калібрування збережено (завантажено)');
            }
        } catch (e) {
            console.error('Помилка збереження калібрування:', e);
            this.addLog('Помилка збереження калібрування: ' + e.message, 'error');
        }
    }

    loadCalibration(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const calData = JSON.parse(text);

                if (typeof calData === 'object' && calData !== null) {
                    this.cal = calData;
                    this.addLog('Калібрування успішно завантажено');

                    event.target.value = '';
                } else {
                    throw new Error('Невірний формат даних калібрування');
                }
            } catch (err) {
                console.error('Помилка завантаження калібрування:', err);
                this.addLog('Помилка завантаження калібрування: ' + err.message, 'error');
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
        this.width = this.video.videoWidth;
        this.height = this.video.videoHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.cx = Math.floor(this.width / 2);
        this.cy = Math.floor(this.height / 2);
        this.dm = Math.hypot(this.cx, this.cy);
        this.area = this.width * this.height;
        this.src = new cv.Mat(this.height, this.width, cv.CV_8UC4);
        this.dst = new cv.Mat(this.height, this.width, cv.CV_8UC4);
        this.gray = new cv.Mat();
        this.blurred = new cv.Mat();
        if (window.ShadowRemoval) {
            window.ShadowRemoval.initializeMats(this.width, this.height);
        }
        this.thresh = new cv.Mat();
        this.initCalibration();
        const startBtn = this.getElement(ELEMENT_IDS.START_BTN);
        if (startBtn) {
            startBtn.style.display = 'none';
        }
        this.animate();
    }

    initCalibration() {
        if (window?.CalibrationManager?.isLoaded && window.CalibrationManager.pixelsPerMm) {
            this.updateCalibrationFromManager();
        } else {
            for (let x = 0; x <= this.dm; x += this.pixelBase) {
                this.cal[x] = this.calRange / this.dm;
            }
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
        

        let scale;
        
        if (this.calibrationMode === 'json' && window?.CalibrationManager?.pixelsPerMm) {

            scale = 1 / window.CalibrationManager.pixelsPerMm;
        } else if (this.cal && Object.keys(this.cal).length > 0) {

            const rounded = this.baseround(d, this.pixelBase);
            scale = this.cal[rounded] || this.cal[this.pixelBase] || 1;
        } else {

            scale = 1 / this.pixelBase;
        }
        

        if (d > 30 && d < 40 && !this.convDebugLogged) {
            console.log(`conv() debug: d=${d.toFixed(1)}px, scale=${scale?.toFixed(6)}, mode=${this.calibrationMode}, expected_mm=${(d * scale).toFixed(2)}`);
            this.convDebugLogged = true;
        }
        
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
        

        if (this.calibrationMode !== 'manual') {
            this.calibrationMode = 'manual';
            this.updateCalibrationUI();
            this.addLog('Перемкнено на ручне калібрування');
        }
        

        this.manualCalibration = JSON.parse(JSON.stringify(this.cal));
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

            if (oldThreshold !== this.autoThreshold || oldBlur !== this.autoBlur) {
                this.addLog(`Threshold: ${this.autoThreshold}, Blur: ${this.autoBlur}`, 'debug');
            }
        } else if (this.keyFlags.norms) {
            const oldAlpha = this.normAlpha;
            const oldBeta = this.normBeta;
            this.normAlpha = Math.floor(64 * x / this.width);
            this.normBeta = Math.min(255, Math.floor(128 + (128 * y / this.height)));

            if (oldAlpha !== this.normAlpha || oldBeta !== this.normBeta) {
                this.addLog(`Normalize - Alpha: ${this.normAlpha}, Beta: ${this.normBeta}`, 'debug');
            }
        }


        if (this.rightMouseDown && this.keyFlags.circleMode) {
            this.mouseNow = { x: ox, y: oy };
        } else if (!this.keyFlags.lock) {
            this.mouseNow = { x: ox, y: oy };
        }
    }

    handleMouseClick(e) {

        if (e.button === 2) {
            return; 
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ox = x - this.cx;
        const oy = (y - this.cy) * -1;


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

        if (!this.keyFlags.auto && !this.keyFlags.config &&
            !this.keyFlags.percent && !this.keyFlags.thresh && !this.keyFlags.norms) {

            const rect = this.canvas.getBoundingClientRect();
            const x = e ? (e.clientX - rect.left) : this.mouseRaw.x;
            const y = e ? (e.clientY - rect.top) : this.mouseRaw.y;
            const ox = x - this.cx;
            const oy = (y - this.cy) * -1;

            this.keyFlags.circleMode = true;
            this.mouseMark = { x: ox, y: oy };
            this.rightMouseDown = true;
        } else {

            this.clearKeyFlags();
            this.mouseMark = null;
            this.rightMouseDown = false;
        }
    }

    handleMouseDown(e) {

        if (e.button === 2) {
            if (!this.keyFlags.auto && !this.keyFlags.config &&
                !this.keyFlags.percent && !this.keyFlags.thresh && !this.keyFlags.norms) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const ox = x - this.cx;
                const oy = (y - this.cy) * -1;

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

        if (e.button === 2) { 
            if (this.rightMouseDown && this.keyFlags.circleMode) {

                this.rightMouseDown = false;
            }
        }
    }

    handleKeyPress(e) {

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
                this._normalizeLogged = false; 
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
        if (this.keyFlags.rotate) {
            this.ctx.save();
            this.ctx.translate(this.width / 2, this.height / 2);
            this.ctx.rotate(Math.PI);
            this.ctx.translate(-this.width / 2, -this.height / 2);
        }

        this.ctx.drawImage(this.video, 0, 0, this.width, this.height);

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

                const output = new ImageData(
                    new Uint8ClampedArray(this.dst.data),
                    this.width,
                    this.height
                );
                this.ctx.putImageData(output, 0, 0);
            }
        } catch (e) {
            console.warn('Binary conversion failed:', e);
        }
    }

    processNormalizeMode(infoText) {
        infoText += `\nNORMALIZE MODE\nALPHA (min): ${this.normAlpha}\nBETA (max): ${this.normBeta}`;


        try {
            const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
            if (this.src && this.dst) {
                this.src.data.set(imageData.data);
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

            cv.findContours(this.thresh, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

            this.addLog(`=== AUTO MODE: Found ${contours.size()} contours ===`);

            let objectCount = 0;
            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);


                const hierarchyIdx = i * 4;
                const parent = hierarchy.data32S[hierarchyIdx + 3];
                const isHole = parent >= 0;

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


                const ratio = Math.min(xlen, ylen) / Math.max(xlen, ylen);
                const isCircular = ratio >= 0.85; 

                let alen = 0;
                let circleData = null;

                if (isCircular) {

                    try {
                        circleData = cv.minEnclosingCircle(contour);
                        const circleCenterX = circleData.center.x;
                        const circleCenterY = circleData.center.y;
                        const circleRadius = circleData.radius;
                        const centerXc = circleCenterX - this.cx;
                        const centerYc = (circleCenterY - this.cy) * -1;
                        const centerConv = this.conv(centerXc, centerYc);
                        const rounded = this.baseround(circleRadius, this.pixelBase);
                        const scale = this.cal[rounded] || this.cal[this.pixelBase];
                        const radiusConv = circleRadius * Math.abs(scale);
                        alen = radiusConv * 2;
                    } catch (e) {
                        console.warn('Failed to calculate minEnclosingCircle:', e);
                        alen = (xlen + ylen) / 2;
                    }
                } else if (ratio >= 0.95) {
                    alen = (xlen + ylen) / 2;
                }

                const colorName = this.autoColors[objectCount % this.autoColors.length];

                this.logObjectMeasurement(objectCount, x1, y1, xlen, ylen, carea, alen, percent, colorName, isCircular);

                try {
                    const objectName = `obj${objectCount}`;
                    const diagLen = Math.hypot(xlen, ylen);
                    const shapeType = isCircular ? 'circular' : 'rectangular';
                    this.saveMeasurementCSV(objectName, 'auto', xlen, ylen, diagLen, carea, percent, shapeType);
                } catch (e) {
                    console.warn('JSON save failed:', e);
                }

                this.drawObjectAnnotations(x1, y1, x2, y2, x3, y3, w, h, xlen, ylen, carea, alen, colorName, isCircular, circleData);

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

    logObjectMeasurement(objectCount, x1, y1, xlen, ylen, carea, alen, percent, colorName, isCircular = false) {
        this.addLog(`Об'єкт №${objectCount}:`, 'info');

        if (isCircular) {
            this.addLog(`  Тип: КРУГЛИЙ`, 'info');
            if (alen) {
                this.addLog(`  Діаметр: ${alen.toFixed(2)}${this.unitSuffix}`, 'info');
            }
        } else {
            this.addLog(`  Тип: ПРЯМОКУТНИЙ`, 'info');
            this.addLog(`  Ширина: ${xlen.toFixed(2)}${this.unitSuffix}`, 'info');
            this.addLog(`  Висота: ${ylen.toFixed(2)}${this.unitSuffix}`, 'info');
        }

        this.addLog(`  Площа: ${carea.toFixed(2)}${this.unitSuffix}²`, 'info');
        if (alen && !isCircular) {
            this.addLog(`  Середнє: ${alen.toFixed(2)}${this.unitSuffix}`, 'info');
        }
        this.addLog(`  Відсоток: ${percent.toFixed(2)}%`, 'info');
        this.addLog(`  Колір: ${colorName}`, 'info');
    }

    drawObjectAnnotations(x1, y1, x2, y2, x3, y3, w, h, xlen, ylen, carea, alen, colorName, isCircular = false, circleData = null) {
        if (isCircular && circleData) {

            const centerX = circleData.center.x;
            const centerY = circleData.center.y;
            const radius = circleData.radius;

            this.ctx.strokeStyle = this.colors[colorName] || colorName;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            this.ctx.stroke();


            if (alen) {
                this.drawText(
                    `⌀ ${alen.toFixed(2)}`,
                    centerX,
                    centerY - radius - 8,
                    { color: colorName, center: true }
                );
            }


            this.drawText(
                `Area: ${carea.toFixed(2)}`,
                centerX,
                centerY + radius + 8,
                { color: colorName, center: true, top: true }
            );
        } else {

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
            const xlen = Math.abs(conv1.x - conv2.x);
            const ylen = Math.abs(conv1.y - conv2.y);
            const llen = Math.hypot(xlen, ylen);
            const rectArea = xlen * ylen;

            let alen = 0;
            const ratio = Math.min(xlen, ylen) / Math.max(xlen, ylen);
            if (ratio >= 0.95) {
                alen = (xlen + ylen) / 2;
            }
            let radius = 0;
            let diameter = 0;
            let circleArea = 0;

            if (this.keyFlags.circleMode) {
                radius = llen;
                diameter = radius * 2;
                circleArea = Math.PI * (radius * radius);
            }

            this.addLog('=== РУЧНЕ ВИМІРЮВАННЯ ===');
            if (this.keyFlags.circleMode) {
                this.addLog(`Режим: КОЛО (Центр → Радіус)`);
                this.addLog(`Радіус: ${radius.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Діаметр: ${diameter.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Площа: ${circleArea.toFixed(2)}${this.unitSuffix}²`);
            } else {
                this.addLog(`Режим: ПРЯМОКУТНИК`);
                this.addLog(`X довжина: ${xlen.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Y довжина: ${ylen.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Діагональ: ${llen.toFixed(2)}${this.unitSuffix}`);
                this.addLog(`Площа: ${rectArea.toFixed(2)}${this.unitSuffix}²`);
                if (alen) {
                    this.addLog(`Середнє (квадрат): ${alen.toFixed(2)}${this.unitSuffix}`);
                }
            }
            this.addLog(`Піксельні координати: (${x1}, ${y1}) до (${x2}, ${y2})`);
            this.addLog('===========================');

            try {
                const objectName = (this.getElement(ELEMENT_IDS.OBJECT_NAME)?.value?.trim()) || 'manual';
                if (this.keyFlags.circleMode) {
                    this.saveMeasurementCSV(objectName, 'manual_circle', diameter, diameter, diameter, circleArea, null, 'circular');
                } else {
                    this.saveMeasurementCSV(objectName, 'manual_rect', xlen, ylen, llen, rectArea, null, 'rectangular');
                }
            } catch (e) {
                console.warn('Manual measurement JSON save failed:', e);
            }

            if (this.keyFlags.circleMode) {
                infoText += `\nMODE: CIRCLE\n`;
                infoText += `RADIUS: ${radius.toFixed(2)}${this.unitSuffix}\n`;
                infoText += `DIAMETER: ${diameter.toFixed(2)}${this.unitSuffix}`;
            } else {
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
                const pixelRadius = Math.hypot(px2 - px1, py2 - py1);

                this.ctx.strokeStyle = this.colors['red'];
                this.ctx.lineWidth = weight;
                this.ctx.beginPath();
                this.ctx.arc(px1, py1, pixelRadius, 0, 2 * Math.PI);
                this.ctx.stroke();
                this.drawLine(px1, py1, px2, py2, weight, 'green');
                this.drawCrosshairs(3, 2, 'red', false);

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

window.CamRuler = CamRuler;