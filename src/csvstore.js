(function () {
    const DEFAULT_CONFIG = {
        JSON_FLUSH_DELAY: 2000,
        UNIT_SUFFIX: 'mm',
        JSON_FILENAME: 'measurements.json'
    };

    class JSONStore {
        constructor() {
            this.measurements = [];
            this.jsonFlushTimer = null;
            this.saveDirHandle = null;
            this.unitSuffix = DEFAULT_CONFIG.UNIT_SUFFIX;
            this.debugLog = (msg) => {
                try {
                    if (window.Logger?.add) {
                        window.Logger.add(msg, 'debug');
                    }
                } catch (e) {
                    console.debug('Налагодження:', msg);
                }
            };
        }

        setUnitSuffix(s) {
            this.unitSuffix = s;
        }

        saveMeasurement(objectName, mode, xlen, ylen, diagonal, area, percent, shapeType = null) {
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

                
                existingData.push(...this.measurements);
                
                
                const content = JSON.stringify(existingData, null, 2);

                
                if (!this.saveDirHandle) {
                    
                    if (window.Logger) {
                        window.Logger.add(
                            `JSON data ready (${this.measurements.length} measurements) - Please select save folder (Choose Folder button) or Export JSON to save`,
                            'warn'
                        );
                    }
                    
                    return;
                }

                
                if (this.saveDirHandle?.getFileHandle) {
                    try {
                        const fh = await this.saveDirHandle.getFileHandle(filename, { create: true });
                        const writable = await fh.createWritable();
                        await writable.write(content);
                        await writable.close();

                        if (window.Logger) {
                            window.Logger.add(`JSON saved to folder: ${filename} (${existingData.length} total measurements)`);
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
                if (window.Logger) {
                    window.Logger.add('Starting export...', 'info');
                }

                // Flush any pending measurements first
                if (this.jsonFlushTimer) {
                    clearTimeout(this.jsonFlushTimer);
                    this.jsonFlushTimer = null;
                }
                
                try {
                    await this.flushJsonBuffer();
                } catch (e) {
                    console.warn('Error flushing buffer during export:', e);
                }

                
                let allMeasurements = [...this.measurements];
                
                
                if (allMeasurements.length === 0 && !this.saveDirHandle) {
                    if (window.Logger) {
                        window.Logger.add('No measurements to export. Make some measurements first or select a folder.', 'warn');
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
                            try {
                                const existingData = JSON.parse(text);
                                if (Array.isArray(existingData)) {
                                    allMeasurements = [...existingData, ...allMeasurements];
                                }
                            } catch (parseErr) {
                                if (window.Logger) {
                                    window.Logger.add('Warning: existing file is invalid JSON, will overwrite', 'warn');
                                }
                            }
                        }
                    } catch (e) {
                        // File doesn't exist or is invalid, use only current measurements
                    }

                    // Write merged data
                    if (allMeasurements.length > 0) {
                        const content = JSON.stringify(allMeasurements, null, 2);
                        try {
                            const fh = await this.saveDirHandle.getFileHandle(filename, { create: true });
                            const writable = await fh.createWritable({ keepExistingData: false });
                            await writable.write(content);
                            await writable.close();

                            if (window.Logger) {
                                window.Logger.add(`✓ JSON exported: ${filename} (${allMeasurements.length} total measurements)`, 'info');
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
                            // Fall through to download fallback
                        }
                    }
                }

                // Fallback: download as file
                if (allMeasurements.length > 0) {
                    const content = JSON.stringify(allMeasurements, null, 2);
                    this.downloadJSON(DEFAULT_CONFIG.JSON_FILENAME, content);
                    
                    if (window.Logger) {
                        window.Logger.add(`✓ JSON downloaded: ${DEFAULT_CONFIG.JSON_FILENAME} (${allMeasurements.length} measurements)`, 'info');
                    }
                    
                    this.measurements = [];
                } else {
                    if (window.Logger) {
                        window.Logger.add('No data to export', 'info');
                    }
                }
            } catch (e) {
                if (window.Logger) {
                    window.Logger.add(
                        'Export failed: ' + (e?.message || e),
                        'error'
                    );
                }
                console.error('Export error:', e);
            }
        }
    }

    // Create instance and expose as both JSONStore and CSVStore (for backward compatibility)
    const store = new JSONStore();
    window.JSONStore = store;
    window.CSVStore = store; // Keep CSVStore name for backward compatibility
})();
