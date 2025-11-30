const GALLERY_ELEMENT_IDS = {
    CHOOSE_LOCAL_FOLDER: 'chooseLocalFolder',
    LOCAL_FOLDER_LABEL: 'localFolderLabel',
    LOCAL_FILE_SELECT: 'localFileSelect',
    LOCAL_LOAD_BTN: 'localLoadBtn',
    ORIG_CANVAS: 'origCanvas',
    GRAY_CANVAS: 'grayCanvas',
    THRESH_CANVAS: 'threshCanvas',
    INV_CANVAS: 'invCanvas',
    HIST_CANVAS: 'histCanvas',
    DETAIL_INFO: 'detailInfo',
    META_BLOCK: 'metaBlock'
};

const HISTOGRAM_CONFIG = {
    WIDTH: 512,
    HEIGHT: 200,
    BACKGROUND_COLOR: '#222',
    BAR_COLOR: '#88ff88'
};

const IMAGE_EXTENSIONS_REGEX = /\.(jpe?g|png|gif)$/i;

 
function getElement(id) {
    return document.getElementById(id);
}

 
document.addEventListener('DOMContentLoaded', () => {
    const chooseBtn = getElement(GALLERY_ELEMENT_IDS.CHOOSE_LOCAL_FOLDER);
    const folderLabel = getElement(GALLERY_ELEMENT_IDS.LOCAL_FOLDER_LABEL);
    const fileSelect = getElement(GALLERY_ELEMENT_IDS.LOCAL_FILE_SELECT);
    const loadBtn = getElement(GALLERY_ELEMENT_IDS.LOCAL_LOAD_BTN);

    if (chooseBtn) {
        chooseBtn.addEventListener('click', async () => {
            await handleFolderSelection(folderLabel, fileSelect);
        });
    }
    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            await handleFileLoad(fileSelect);
        });
    }
});

 
async function handleFolderSelection(folderLabel, fileSelect) {
    try {
        if (!window.showDirectoryPicker) {
            alert('Directory picker not available in this browser');
            return;
        }

        const handle = await window.showDirectoryPicker();
        window._camrulerSelectedDir = handle;

        if (folderLabel) {
            folderLabel.textContent = handle.name || '(chosen)';
        }

        await populateLocalFileSelect(handle, fileSelect);
    } catch (e) {
        console.warn('Folder pick cancelled or failed', e);
    }
}

 
async function handleFileLoad(fileSelect) {
    if (!window._camrulerSelectedDir) {
        alert('No folder chosen');
        return;
    }

    const sel = fileSelect ? fileSelect.value : null;
    if (!sel) {
        alert('No file selected');
        return;
    }

    try {
        const fh = await window._camrulerSelectedDir.getFileHandle(sel);
        const targets = {
            origCanvas: getElement(GALLERY_ELEMENT_IDS.ORIG_CANVAS),
            grayCanvas: getElement(GALLERY_ELEMENT_IDS.GRAY_CANVAS),
            threshCanvas: getElement(GALLERY_ELEMENT_IDS.THRESH_CANVAS),
            invCanvas: getElement(GALLERY_ELEMENT_IDS.INV_CANVAS),
            histCanvas: getElement(GALLERY_ELEMENT_IDS.HIST_CANVAS),
            infoEl: getElement(GALLERY_ELEMENT_IDS.DETAIL_INFO),
            metaEl: getElement(GALLERY_ELEMENT_IDS.META_BLOCK)
        };

        await loadImageFromFileHandle(fh, targets);
    } catch (e) {
        console.error(e);
        alert('Failed to load file from folder: ' + (e && e.message ? e.message : e));
    }
}

 
function loadImageElement(src, targets, requestedFile, revokeUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {
        if (targets.origCanvas) {
            targets.origCanvas.width = img.width;
            targets.origCanvas.height = img.height;
            const ctx = targets.origCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
        }

        const run = () => performGalleryProcessing(img, targets);

        if (typeof cvReady !== 'undefined' && !cvReady) {
            window.runGalleryDetail = run;
        } else {
            run();
        }

        if (revokeUrl) {
            setTimeout(() => URL.revokeObjectURL(src), 2000);
        }
    };

    img.onerror = () => {
        if (targets.infoEl) {
            targets.infoEl.textContent = 'Failed to load image.';
        }
    };
}

 
function performGalleryProcessing(img, targets) {
    try {
        const { origCanvas, grayCanvas, threshCanvas, invCanvas, histCanvas, infoEl } = targets;

        const src = cv.imread(img);
        const gray = new cv.Mat();

        // Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        if (grayCanvas) {
            grayCanvas.width = gray.cols;
            grayCanvas.height = gray.rows;
            cv.imshow(grayCanvas, gray);
        }

        // Apply threshold
        const thresh = new cv.Mat();
        try {
            cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        } catch (e) {
            cv.threshold(gray, thresh, 127, 255, cv.THRESH_BINARY);
        }

        if (threshCanvas) {
            threshCanvas.width = thresh.cols;
            threshCanvas.height = thresh.rows;
            cv.imshow(threshCanvas, thresh);
        }

        // Invert threshold
        const inv = new cv.Mat();
        cv.bitwise_not(thresh, inv);

        if (invCanvas) {
            invCanvas.width = inv.cols;
            invCanvas.height = inv.rows;
            cv.imshow(invCanvas, inv);
        }

        // Create histogram
        if (histCanvas) {
            createHistogram(gray, histCanvas);
        }

        if (infoEl) {
            infoEl.textContent = `Processed: ${img.src}`;
        }

        // Clean up
        src.delete();
        gray.delete();
        thresh.delete();
        inv.delete();
    } catch (e) {
        console.error('Error processing gallery image', e);
        if (targets?.infoEl) {
            targets.infoEl.textContent = 'Processing error: ' + (e && e.message ? e.message : e);
        }
    }
}

 
function createHistogram(grayMat, canvas) {
    const hist = new cv.Mat();
    const mask = new cv.Mat();
    const channels = [0];
    const histSize = [256];
    const ranges = [0, 255];
    const matVec = new cv.MatVector();

    matVec.push_back(grayMat);
    cv.calcHist(matVec, channels, mask, hist, histSize, ranges, false);

    const hCtx = canvas.getContext('2d');
    const w = canvas.width = HISTOGRAM_CONFIG.WIDTH;
    const h = canvas.height = HISTOGRAM_CONFIG.HEIGHT;

    hCtx.clearRect(0, 0, w, h);

    // Find max value for scaling
    let max = 0;
    const histData = hist.data32F || hist.data32S || [];
    for (let i = 0; i < histData.length; i++) {
        if (histData[i] > max) {
            max = histData[i];
        }
    }

    const binW = w / (histData.length || 256);

    // Draw background
    hCtx.fillStyle = HISTOGRAM_CONFIG.BACKGROUND_COLOR;
    hCtx.fillRect(0, 0, w, h);

    // Draw histogram bars
    hCtx.fillStyle = HISTOGRAM_CONFIG.BAR_COLOR;
    for (let i = 0; i < histData.length; i++) {
        const val = histData[i];
        const scaled = (val / (max || 1)) * h;
        hCtx.fillRect(i * binW, h - scaled, Math.max(1, Math.ceil(binW)), scaled);
    }

    // Clean up
    hist.delete();
    mask.delete();
    matVec.delete();
}

// Populate file select with image files from directory
async function populateLocalFileSelect(dirHandle, selectEl) {
    if (!dirHandle || !selectEl) {
        return;
    }

    try {
        selectEl.innerHTML = '<option value="">(none)</option>';

        for await (const entry of dirHandle.values()) {
            try {
                if (entry.kind === 'file') {
                    const name = entry.name || '';
                    if (IMAGE_EXTENSIONS_REGEX.test(name)) {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        selectEl.appendChild(opt);
                    }
                }
            } catch (e) {
                console.warn('Failed to process dir entry:', e);
            }
        }
    } catch (e) {
        console.error('populateLocalFileSelect error', e);
    }
}

// Load image from FileHandle (File System Access API)
async function loadImageFromFileHandle(fileHandle, targets) {
    try {
        const file = await fileHandle.getFile();
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;

        img.onload = () => {
            const { origCanvas, grayCanvas, threshCanvas, invCanvas, histCanvas, infoEl, metaEl } = targets;

            if (metaEl) {
                metaEl.textContent = `Filename: ${file.name} — Size: ${file.size} bytes — Type: ${file.type || 'unknown'} — Modified: ${new Date(file.lastModified).toLocaleString()}`;
            }

            if (origCanvas) {
                origCanvas.width = img.width;
                origCanvas.height = img.height;
                const ctx = origCanvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
            }

            performGalleryProcessing(img, targets);
            URL.revokeObjectURL(url);
        };
    } catch (e) {
        console.error('loadImageFromFileHandle error', e);
        if (targets?.infoEl) {
            targets.infoEl.textContent = 'Failed to load local file: ' + (e.message || e);
        }
    }
}
