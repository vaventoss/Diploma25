(function () {
    const DEFAULT_CONFIG = {
        JSON_FLUSH_DELAY: 2000,
        UNIT_SUFFIX: 'mm',
        JSON_FILENAME: 'measurements.json'
    };

    class JSONStore {
        constructor() {
            this.measurements = []; // Array to store all measurements
            this.jsonFlushTimer = null;
            this.saveDirHandle = null;
            this.unitSuffix = DEFAULT_CONFIG.UNIT_SUFFIX;
        }

        setUnitSuffix(s) {
            this.unitSuffix = s;
        }

        saveMeasurement(objectName, mode, xlen, ylen, diagonal, area, percent, shapeType = null) {
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

                this.measurements.push(measurement);
                this.scheduleJsonFlush();
            } catch (e) {
                console.warn('JSONStore.saveMeasurement error', e);
            }
        }

        scheduleJsonFlush(delay = DEFAULT_CONFIG.JSON_FLUSH_DELAY) {
            try {
                if (this.jsonFlushTimer) {
                    clearTimeout(this.jsonFlushTimer);
                }

                this.jsonFlushTimer = setTimeout(() => {
                    this.flushJsonBuffer().catch(err => {
                        console.warn('JSON flush error', err);
                    });
                    this.jsonFlushTimer = null;
                }, delay);
            } catch (e) {
                console.warn('JSONStore.scheduleJsonFlush error', e);
            }
        }

        async flushJsonBuffer() {
            try {
                if (!this.measurements || this.measurements.length === 0) {
                    return;
                }

                const filename = DEFAULT_CONFIG.JSON_FILENAME;
                
                // Read existing file if it exists, otherwise start with empty array
                let existingData = [];
                if (this.saveDirHandle?.getFileHandle) {
                    try {
                        const fh = await this.saveDirHandle.getFileHandle(filename, { create: false });
                        const file = await fh.getFile();
                        const text = await file.text();
                        if (text.trim()) {
                            existingData = JSON.parse(text);
                            if (!Array.isArray(existingData)) {
                                existingData = [];
                            }
                        }
                    } catch (e) {
                        // File doesn't exist or is invalid, start with empty array
                        existingData = [];
                    }
                }

                // Append new measurements to existing data
                existingData.push(...this.measurements);
                
                // Write back to file
                const content = JSON.stringify(existingData, null, 2);

                // Check if we have a save directory handle
                if (!this.saveDirHandle) {
                    // Don't auto-download, warn user instead
                    if (window.Logger) {
                        window.Logger.add(
                            `JSON data ready (${this.measurements.length} measurements) - Please select save folder (Choose Folder button) or Export JSON to save`,
                            'warn'
                        );
                    }
                    // Keep measurements for later save
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
                            window.Logger.add(`JSON saved to folder: ${filename} (${existingData.length} total measurements)`);
                        }

                        // Clear only the measurements we just saved
                        this.measurements = [];
                        return;
                    } catch (e) {
                        if (window.Logger) {
                            window.Logger.add(
                                'Failed to write JSON to folder: ' + (e?.message || e),
                                'warn'
                            );
                        }
                    }
                }

                // If we get here, folder was selected but write failed
                if (window.Logger) {
                    window.Logger.add(
                        `Could not save JSON - check folder permissions`,
                        'error'
                    );
                }
            } catch (e) {
                console.warn('JSONStore.flushJsonBuffer error', e);
            }
        }

        downloadJSON(filename, content) {
            const blob = new Blob([content], { type: 'application/json' });
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
                // Flush any pending measurements first
                if (this.jsonFlushTimer) {
                    clearTimeout(this.jsonFlushTimer);
                    this.jsonFlushTimer = null;
                }
                await this.flushJsonBuffer();

                // If there are still measurements in buffer, include them
                let allMeasurements = [...this.measurements];
                
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
                                'Directory pick cancelled; will download file instead',
                                'info'
                            );
                        }
                    }
                }

                // If we have a save directory, try to read existing file and merge
                if (this.saveDirHandle?.getFileHandle) {
                    const filename = DEFAULT_CONFIG.JSON_FILENAME;
                    try {
                        const fh = await this.saveDirHandle.getFileHandle(filename, { create: false });
                        const file = await fh.getFile();
                        const text = await file.text();
                        if (text.trim()) {
                            const existingData = JSON.parse(text);
                            if (Array.isArray(existingData)) {
                                allMeasurements = [...existingData, ...allMeasurements];
                            }
                        }
                    } catch (e) {
                        // File doesn't exist or is invalid, use only current measurements
                    }

                    // Write merged data
                    const content = JSON.stringify(allMeasurements, null, 2);
                    try {
                        const fh = await this.saveDirHandle.getFileHandle(filename, { create: true });
                        const writable = await fh.createWritable();
                        await writable.write(content);
                        await writable.close();

                        if (window.Logger) {
                            window.Logger.add(`JSON exported: ${filename} (${allMeasurements.length} total measurements)`);
                        }

                        this.measurements = [];
                        return;
                    } catch (e) {
                        if (window.Logger) {
                            window.Logger.add(
                                'Failed to write JSON to folder: ' + (e?.message || e),
                                'warn'
                            );
                        }
                    }
                }

                // Fallback: download as file
                if (allMeasurements.length > 0) {
                    const content = JSON.stringify(allMeasurements, null, 2);
                    this.downloadJSON(DEFAULT_CONFIG.JSON_FILENAME, content);
                    
                    if (window.Logger) {
                        window.Logger.add(`JSON downloaded: ${DEFAULT_CONFIG.JSON_FILENAME} (${allMeasurements.length} measurements)`);
                    }
                    
                    this.measurements = [];
                } else {
                    if (window.Logger) {
                        window.Logger.add('No JSON data to export', 'info');
                    }
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

    // Create instance and expose as both JSONStore and CSVStore (for backward compatibility)
    const store = new JSONStore();
    window.JSONStore = store;
    window.CSVStore = store; // Keep CSVStore name for backward compatibility
})();
