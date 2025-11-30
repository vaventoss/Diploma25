(function () {
    const SHADOW_CONFIG = {
        // CLAHE clip limit
        CLAHE_CLIP_LIMIT: 3.0,
        
        // CLAHE tile grid size
        CLAHE_TILE_SIZE: 8,
        
        // Fallback: Gaussian blur size
        BLUR_SIZE: 45
    };

    class ShadowRemoval {
        constructor() {
            this.enabled = false;
            this.frameCount = 0;
            this.errorCount = 0;
        }

        initializeMats(width, height) {
            // No persistent matrices needed
        }

        cleanupMats() {
            // No persistent matrices to clean
        }

        /**
         * Remove shadows - tries CLAHE first, falls back to homomorphic filtering
         */
        removeShadows(src, dst) {
            if (!this.enabled || !src || !dst) {
                if (src && dst && src !== dst) {
                    src.copyTo(dst);
                }
                return;
            }

            this.frameCount++;
            
            // Check OpenCV availability
            if (typeof cv === 'undefined') {
                console.error('OpenCV not available!');
                this.enabled = false;
                return;
            }

            // Try CLAHE first, fallback to homomorphic if CLAHE unavailable
            const useCLAHE = typeof cv.CLAHE !== 'undefined';
            
            if (this.frameCount === 1) {
                console.log('Shadow removal method:', useCLAHE ? 'CLAHE' : 'Homomorphic filtering');
            }

            if (useCLAHE) {
                this.removeShadowsCLAHE(src, dst);
            } else {
                this.removeShadowsHomomorphic(src, dst);
            }
        }

        /**
         * CLAHE-based shadow removal
         */
        removeShadowsCLAHE(src, dst) {
            let rgb = null;
            let lab = null;
            let labChannels = null;
            let clahe = null;
            let enhanced = null;
            let result = null;

            try {
                rgb = new cv.Mat();
                cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

                lab = new cv.Mat();
                cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);

                labChannels = new cv.MatVector();
                cv.split(lab, labChannels);
                
                const lChannel = labChannels.get(0);
                const aChannel = labChannels.get(1);
                const bChannel = labChannels.get(2);

                clahe = new cv.CLAHE(
                    SHADOW_CONFIG.CLAHE_CLIP_LIMIT,
                    new cv.Size(SHADOW_CONFIG.CLAHE_TILE_SIZE, SHADOW_CONFIG.CLAHE_TILE_SIZE)
                );
                
                enhanced = new cv.Mat();
                clahe.apply(lChannel, enhanced);

                const enhancedChannels = new cv.MatVector();
                enhancedChannels.push_back(enhanced);
                enhancedChannels.push_back(aChannel);
                enhancedChannels.push_back(bChannel);

                result = new cv.Mat();
                cv.merge(enhancedChannels, result);

                cv.cvtColor(result, result, cv.COLOR_Lab2RGB);
                cv.cvtColor(result, dst, cv.COLOR_RGB2RGBA);

                enhancedChannels.delete();

            } catch (e) {
                this.errorCount++;
                console.error('CLAHE shadow removal error (frame ' + this.frameCount + '):', e);
                
                if (src && dst && src !== dst) {
                    try {
                        src.copyTo(dst);
                    } catch (copyErr) {
                        console.error('Fallback failed:', copyErr);
                    }
                }
                
                // Disable if too many errors
                if (this.errorCount > 10) {
                    console.error('Too many errors, disabling shadow removal');
                    this.enabled = false;
                }
            } finally {
                [rgb, lab, labChannels, enhanced, result].forEach(mat => {
                    if (mat) {
                        try { mat.delete(); } catch (e) {}
                    }
                });
                if (clahe) {
                    try { clahe.delete(); } catch (e) {}
                }
            }
        }

        /**
         * Homomorphic filtering fallback
         */
        removeShadowsHomomorphic(src, dst) {
            let rgb = null;
            let gray = null;
            let blurred = null;
            let result = null;

            try {
                rgb = new cv.Mat();
                cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

                gray = new cv.Mat();
                cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);

                blurred = new cv.Mat();
                const ksize = new cv.Size(SHADOW_CONFIG.BLUR_SIZE, SHADOW_CONFIG.BLUR_SIZE);
                cv.GaussianBlur(gray, blurred, ksize, 0);

                // Normalize each channel
                const channels = new cv.MatVector();
                cv.split(rgb, channels);

                for (let i = 0; i < 3; i++) {
                    const channel = channels.get(i);
                    const channelFloat = new cv.Mat();
                    const blurredFloat = new cv.Mat();
                    const ratio = new cv.Mat();
                    const scaled = new cv.Mat();

                    channel.convertTo(channelFloat, cv.CV_32F, 1/255.0);
                    blurred.convertTo(blurredFloat, cv.CV_32F, 1/255.0);
                    
                    cv.add(blurredFloat, new cv.Scalar(0.01), blurredFloat); // Avoid division by zero
                    cv.divide(channelFloat, blurredFloat, ratio);
                    ratio.convertTo(scaled, cv.CV_8U, 128, 0);
                    
                    channels.set(i, scaled);
                    
                    channelFloat.delete();
                    blurredFloat.delete();
                    ratio.delete();
                    scaled.delete();
                }

                result = new cv.Mat();
                cv.merge(channels, result);
                cv.cvtColor(result, dst, cv.COLOR_RGB2RGBA);

                channels.delete();

            } catch (e) {
                this.errorCount++;
                console.error('Homomorphic shadow removal error:', e);
                
                if (src && dst && src !== dst) {
                    src.copyTo(dst);
                }
                
                if (this.errorCount > 10) {
                    console.error('Too many errors, disabling shadow removal');
                    this.enabled = false;
                }
            } finally {
                [rgb, gray, blurred, result].forEach(mat => {
                    if (mat) {
                        try { mat.delete(); } catch (e) {}
                    }
                });
            }
        }

        toggle() {
            this.enabled = !this.enabled;
            this.frameCount = 0;
            this.errorCount = 0;
            console.log('Shadow removal toggled:', this.enabled);
            return this.enabled;
        }

        setEnabled(enabled) {
            this.enabled = !!enabled;
            this.frameCount = 0;
            this.errorCount = 0;
            console.log('Shadow removal set to:', this.enabled);
        }

        isEnabled() {
            return this.enabled;
        }
    }

    window.ShadowRemoval = new ShadowRemoval();
})();
