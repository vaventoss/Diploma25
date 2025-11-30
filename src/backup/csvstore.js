(function () {
    const DEFAULT_CONFIG = {
        CSV_FLUSH_DELAY: 2000,
        UNIT_SUFFIX: 'mm'
    };

    const CSV_HEADER = 'timestamp,mode,x_len,y_len,diagonal,area,percent,units\n';

    class CSVStore {
        constructor() {
            this.csvBuffers = {};
            this.csvFlushTimers = {};
            this.saveDirHandle = null;
            this.unitSuffix = DEFAULT_CONFIG.UNIT_SUFFIX;
        }

        setUnitSuffix(s) {
            this.unitSuffix = s;
        }

        saveMeasurement(objectName, mode, xlen, ylen, diagonal, area, percent) {
            try {
                const ts = new Date().toISOString();
                const percentStr = (typeof percent !== 'undefined' && percent !== null)
                    ? percent.toFixed(3)
                    : '';

                const line = `${ts},${mode},${xlen.toFixed(3)},${ylen.toFixed(3)},${diagonal.toFixed(3)},${area.toFixed(3)},${percentStr},${this.unitSuffix}\n`;

                if (!this.csvBuffers[objectName]) {
                    this.csvBuffers[objectName] = CSV_HEADER;
                }

                this.csvBuffers[objectName] += line;
                this.scheduleCsvFlush(objectName);
            } catch (e) {
                console.warn('CSVStore.saveMeasurement error', e);
            }
        }

        scheduleCsvFlush(objectName, delay = DEFAULT_CONFIG.CSV_FLUSH_DELAY) {
            try {
                if (this.csvFlushTimers[objectName]) {
                    clearTimeout(this.csvFlushTimers[objectName]);
                }

                this.csvFlushTimers[objectName] = setTimeout(() => {
                    this.flushCsvBuffer(objectName).catch(err => {
                        console.warn('CSV flush error', err);
                    });
                    delete this.csvFlushTimers[objectName];
                }, delay);
            } catch (e) {
                console.warn('CSVStore.scheduleCsvFlush error', e);
            }
        }

        async flushCsvBuffer(objectName) {
            try {
                if (!this.csvBuffers[objectName]) {
                    return;
                }

                const filename = `${objectName}_.csv`;
                const content = this.csvBuffers[objectName];

                // Check if we have a save directory handle
                if (!this.saveDirHandle) {
                    // Don't auto-download, warn user instead
                    if (window.Logger) {
                        window.Logger.add(
                            `CSV data ready for "${objectName}" - Please select save folder (Choose Folder button) or Export CSV to save`,
                            'warn'
                        );
                    }
                    // Keep buffer for later save
                    return;
                }

                // Try to save using File System Access API
                if (this.saveDirHandle?.getFileHandle) {
                    try {
                        const fh = await this.saveDirHandle.getFileHandle(filename, { create: true });
                        const writable = await fh.createWritable();
                        await writable.write(content);
                        await writable.close();

                        if (window.Logger) {
                            window.Logger.add(`CSV saved to folder: ${filename}`);
                        }

                        delete this.csvBuffers[objectName];
                        return;
                    } catch (e) {
                        if (window.Logger) {
                            window.Logger.add(
                                'Failed to write CSV to folder: ' + (e?.message || e),
                                'warn'
                            );
                        }
                    }
                }

                // If we get here, folder was selected but write failed
                if (window.Logger) {
                    window.Logger.add(
                        `Could not save CSV for "${objectName}" - check folder permissions`,
                        'error'
                    );
                }
            } catch (e) {
                console.warn('CSVStore.flushCsvBuffer error', e);
            }
        }

        downloadCSV(filename, content) {
            const blob = new Blob([content], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        }

        async exportAll() {
            try {
                const names = Object.keys(this.csvBuffers || {});

                if (!names.length) {
                    if (window.Logger) {
                        window.Logger.add('No CSV data to export', 'info');
                    }
                    return;
                }

                // Request directory if not already set
                if (!this.saveDirHandle && window.showDirectoryPicker) {
                    try {
                        const chosen = await window.showDirectoryPicker();

                        try {
                            this.saveDirHandle = await chosen.getDirectoryHandle('imgs', { create: true });
                        } catch (e) {
                            this.saveDirHandle = chosen;
                        }

                        if (window.Logger) {
                            window.Logger.add('Chosen folder set for export');
                        }
                    } catch (e) {
                        if (window.Logger) {
                            window.Logger.add(
                                'Directory pick cancelled; will download files instead',
                                'info'
                            );
                        }
                    }
                }

                // Flush all buffers
                for (const name of names) {
                    if (this.csvFlushTimers?.[name]) {
                        clearTimeout(this.csvFlushTimers[name]);
                        delete this.csvFlushTimers[name];
                    }
                    await this.flushCsvBuffer(name);
                }

                if (window.Logger) {
                    window.Logger.add('Export complete');
                }
            } catch (e) {
                if (window.Logger) {
                    window.Logger.add(
                        'Export failed: ' + (e?.message || e),
                        'warn'
                    );
                }
            }
        }
    }

    window.CSVStore = new CSVStore();
})();
