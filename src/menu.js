(function () {
    const SELECTORS = {
        CONTROL_BUTTONS: '#controls button[data-action]'
    };

    class Menu {
        constructor(camruler) {
            this.cam = camruler;
            this.bindControls();
            this.updateControlUI();
        }

        // Допоміжна: логування у Logger, якщо доступно
        log(message, level = 'debug') {
            if (window?.Logger?.add) {
                window.Logger.add(message, level);
            }
        }

        // Прив'язати кнопки керування
        bindControls() {
            const controlButtons = document.querySelectorAll(SELECTORS.CONTROL_BUTTONS);

            if (controlButtons?.forEach) {
                controlButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const action = btn.dataset.action;
                        this.handleControlAction(action);
                    });
                });
            }
        }

        // Обробити дію керування
        handleControlAction(action) {
            const cam = this.cam;
            this.log(`МЕНЮ дія: ${action}`, 'debug');

            switch (action) {
                case 'quit':
                    cam.stop();
                    break;

                case 'config':
                    cam.keyFlags.config = !cam.keyFlags.config;
                    if (cam.keyFlags.config) {
                        cam.clearKeyFlags();
                        cam.keyFlags.config = true;
                        cam.calLast = 0;
                        cam.mouseMark = null;
                    }
                    break;

                case 'norms':
                    cam.keyFlags.norms = !cam.keyFlags.norms;
                    if (cam.keyFlags.norms) {
                        cam.keyFlags.thresh = false;
                        cam.keyFlags.percent = false;
                        cam.keyFlags.lock = false;
                        cam.mouseMark = null;
                    }
                    break;

                case 'rotate':
                    cam.keyFlags.rotate = !cam.keyFlags.rotate;
                    break;

                case 'auto':
                    cam.keyFlags.auto = !cam.keyFlags.auto;
                    if (cam.keyFlags.auto) {
                        cam.clearKeyFlags();
                        cam.keyFlags.auto = true;
                        cam.mouseMark = null;
                    }
                    break;

                case 'percent':
                    if (!cam.keyFlags.auto) {
                        cam.keyFlags.auto = true;
                    }
                    cam.keyFlags.percent = !cam.keyFlags.percent;
                    cam.keyFlags.thresh = false;
                    cam.keyFlags.lock = false;
                    break;

                case 'thresh':
                    if (!cam.keyFlags.auto) {
                        cam.keyFlags.auto = true;
                    }
                    cam.keyFlags.thresh = !cam.keyFlags.thresh;
                    cam.keyFlags.percent = false;
                    cam.keyFlags.lock = false;
                    break;

                default:
                    console.warn('Unknown control action', action);
            }

            this.updateControlUI();
            this.log(`МЕНЮ стан: ${JSON.stringify(cam.keyFlags)}`, 'debug');
        }

        // Оновити UI керування
        updateControlUI() {
            const cam = this.cam;
            const btns = document.querySelectorAll(SELECTORS.CONTROL_BUTTONS);

            if (!btns) {
                return;
            }

            btns.forEach(btn => {
                const action = btn.dataset.action;
                btn.classList.remove('active');
                btn.disabled = false;

                // Set active state
                if (action === 'config' && cam.keyFlags.config) {
                    btn.classList.add('active');
                }
                if (action === 'norms' && cam.keyFlags.norms) {
                    btn.classList.add('active');
                }
                if (action === 'rotate' && cam.keyFlags.rotate) {
                    btn.classList.add('active');
                }
                if (action === 'auto' && cam.keyFlags.auto) {
                    btn.classList.add('active');
                }
                if (action === 'percent' && cam.keyFlags.percent) {
                    btn.classList.add('active');
                }
                if (action === 'thresh' && cam.keyFlags.thresh) {
                    btn.classList.add('active');
                }

                // Disable percent/thresh if auto mode not active
                if ((action === 'percent' || action === 'thresh') && !cam.keyFlags.auto) {
                    btn.disabled = true;
                    btn.classList.remove('active');
                }
            });
        }
    }

    window.Menu = Menu;
})();
