(function () {
    const DEFAULT_CONFIG = {
        MAX_LOGS: 1000
    };

    const ELEMENT_IDS = {
        LOG_BODY: 'logBody',
        LOG_TOGGLE: 'logToggle',
        LOG_CLEAR: 'logClear',
        LOG_DOWNLOAD: 'logDownload',
        DEBUG_TOGGLE: 'debugToggle'
    };

    const STORAGE_KEYS = {
        DEBUG_ENABLED: 'camruler_debug_enabled'
    };

    class Logger {
        constructor() {
            this.logBuffer = [];
            this.maxLogs = DEFAULT_CONFIG.MAX_LOGS;
            this.logEl = null;
            this.logVisible = true;
            this.debugEnabled = false;
        }

        // Допоміжна: отримати елемент за ID
        getElement(id) {
            return document.getElementById(id);
        }

        init() {
            this.logEl = this.getElement(ELEMENT_IDS.LOG_BODY);

            this.setupEventListeners();
            this.loadDebugPreference();
            this.renderLogs();
        }

        setupEventListeners() {
            const logToggle = this.getElement(ELEMENT_IDS.LOG_TOGGLE);
            const logClear = this.getElement(ELEMENT_IDS.LOG_CLEAR);
            const logDownload = this.getElement(ELEMENT_IDS.LOG_DOWNLOAD);
            const debugToggle = this.getElement(ELEMENT_IDS.DEBUG_TOGGLE);

            if (logToggle) {
                logToggle.addEventListener('click', () => this.toggle());
            }
            if (logClear) {
                logClear.addEventListener('click', () => this.clear());
            }
            if (logDownload) {
                logDownload.addEventListener('click', () => this.download());
            }
            if (debugToggle) {
                debugToggle.addEventListener('click', () => {
                    this.toggleDebug();
                    debugToggle.textContent = this.debugEnabled ? 'Debug: ON' : 'Debug: OFF';
                });
                debugToggle.textContent = this.debugEnabled ? 'Debug: ON' : 'Debug: OFF';
            }
        }

        loadDebugPreference() {
            try {
                const val = localStorage.getItem(STORAGE_KEYS.DEBUG_ENABLED);
                this.debugEnabled = val === '1';
            } catch (e) {
                console.warn('Failed to load debug preference:', e);
            }
        }

        renderLogs() {
            if (this.logEl && this.logVisible) {
                this.logEl.hidden = false;
                this.logEl.innerHTML = '';

                this.logBuffer.forEach(item => {
                    const div = document.createElement('div');
                    div.className = `log-line log-level-${item.level}`;
                    div.textContent = `[${item.ts}] ${item.message}`;
                    this.logEl.appendChild(div);
                });

                this.logEl.scrollTop = this.logEl.scrollHeight;
            }
        }

        add(message, level = 'info') {
            // Пропускати debug-повідомлення, якщо debug вимкнено
            if (level === 'debug' && !this.debugEnabled) {
                return;
            }

            const ts = new Date().toISOString();
            const line = `[${ts}] ${message}`;

            // Додати до буфера
            this.logBuffer.push({ ts, message, level });
            if (this.logBuffer.length > this.maxLogs) {
                this.logBuffer.shift();
            }

            // Вивід у консоль
            if (level === 'error') {
                console.error(line);
            } else if (level === 'warn') {
                console.warn(line);
            } else {
                console.log(line);
            }

            // Вивід у DOM
            if (this.logEl && this.logVisible) {
                const div = document.createElement('div');
                div.className = `log-line log-level-${level}`;
                div.textContent = line;
                this.logEl.appendChild(div);
                this.logEl.scrollTop = this.logEl.scrollHeight;
            }
        }

        toggleDebug() {
            this.debugEnabled = !this.debugEnabled;

            try {
                localStorage.setItem(
                    STORAGE_KEYS.DEBUG_ENABLED,
                    this.debugEnabled ? '1' : '0'
                );
            } catch (e) {
                console.warn('Failed to save debug preference:', e);
            }

            if (this.debugEnabled) {
                this.add('Налагоджувальне логування увімкнено', 'info');
            } else {
                this.add('Налагоджувальне логування вимкнено', 'info');
            }
        }

        // Показати/сховати лог
        toggle() {
            this.logVisible = !this.logVisible;

            if (!this.logEl) {
                this.logEl = this.getElement(ELEMENT_IDS.LOG_BODY);
            }

            if (this.logEl) {
                if (this.logVisible) {
                    this.logEl.hidden = false;
                    this.logEl.innerHTML = '';

                    this.logBuffer.forEach(item => {
                        const div = document.createElement('div');
                        div.className = `log-line log-level-${item.level}`;
                        div.textContent = `[${item.ts}] ${item.message}`;
                        this.logEl.appendChild(div);
                    });

                    this.logEl.scrollTop = this.logEl.scrollHeight;
                } else {
                    this.logEl.hidden = true;
                }
            }
        }

        // Очистити лог
        clear() {
            this.logBuffer = [];

            if (this.logEl) {
                this.logEl.innerHTML = '';
            }
        }

        // Завантажити лог
        download() {
            const lines = this.logBuffer.map(l => `[${l.ts}] [${l.level.toUpperCase()}] ${l.message}`);
            const content = lines.join('\n');

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `log-${timestamp}.txt`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }
    }

    window.Logger = new Logger();

    try {
        window.Logger.init();
    } catch (e) {
        console.warn('Помилка ініціалізації Logger', e);
    }
})();
