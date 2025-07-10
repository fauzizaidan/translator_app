// public/main.js

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & KONFIGURASI ---
    const state = { sourceLang: 'auto', targetLang: 'id', isMenuOpen: false, lastDetectedLang: null, isListening: false };
    const config = {
        languages: { 'auto': 'Deteksi Bahasa', 'ar': 'Arab', 'nl': 'Belanda', 'bg': 'Bulgaria', 'cs': 'Ceko', 'da': 'Denmark', 'et': 'Estonia', 'fi': 'Finlandia', 'hu': 'Hongaria', 'he': 'Ibrani', 'id': 'Indonesia', 'en': 'Inggris', 'it': 'Italia', 'ja': 'Jepang', 'jv': 'Jawa', 'de': 'Jerman', 'ko': 'Korea', 'lv': 'Latvia', 'lt': 'Lituania', 'zh-CN': 'Mandarin', 'no': 'Norwegia (bokmål)', 'pl': 'Polandia', 'pt': 'Portugis', 'fr': 'Prancis', 'ro': 'Romania', 'ru': 'Rusia', 'sk': 'Slovakia', 'sl': 'Slovenia', 'es': 'Spanyol', 'su': 'Sunda', 'sv': 'Swedia', 'tr': 'Turki', 'uk': 'Ukraina', 'vi': 'Vietnamese', 'el': 'Yunani' },
        needsRomanization: ['ja', 'ko', 'ar', 'he', 'ru', 'el', 'zh-CN', 'bg', 'uk']
    };

    // --- ELEMEN DOM ---
    const dom = {
        textInput: document.getElementById('text-input'),
        sourceLangBtn: document.getElementById('source-lang-btn'),
        sourceLangMenu: document.getElementById('source-lang-menu'),
        targetLangSelect: document.getElementById('target-lang-select'),
        swapBtn: document.getElementById('swap-btn'),
        outputWrapper: document.getElementById('output-wrapper'),
        loadingIndicator: document.getElementById('loading'),
        copyInputBtn: document.getElementById('copy-input-btn'),
        copyOutputBtn: document.getElementById('copy-output-btn'),
        clearInputBtn: document.getElementById('clear-input-btn'),
        micBtn: document.getElementById('mic-btn'),
        copyNotification: document.getElementById('copy-notification')
    };

    // --- FUNGSI-FUNGSI ---
    const populateDropdowns = () => {
        dom.sourceLangMenu.innerHTML = '';
        Object.entries(config.languages).forEach(([code, name]) => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.dataset.value = code;
            option.setAttribute('role', 'option');
            option.innerHTML = `<i class="fa-solid fa-check"></i><span>${name}</span>`;
            dom.sourceLangMenu.appendChild(option);
        });
        dom.targetLangSelect.innerHTML = '';
        Object.entries(config.languages).forEach(([code, name]) => {
            if (code !== 'auto') dom.targetLangSelect.add(new Option(name, code));
        });
        dom.targetLangSelect.value = state.targetLang;
        updateUI();
    };
    
    const updateUI = () => {
        const btnText = dom.sourceLangBtn.querySelector('span');
        if (state.sourceLang === 'auto' && state.lastDetectedLang && config.languages[state.lastDetectedLang] && dom.textInput.value.trim()) {
            btnText.innerHTML = `${config.languages[state.lastDetectedLang]} <small>(terdeteksi)</small>`;
        } else {
            btnText.textContent = config.languages[state.sourceLang];
        }
        dom.sourceLangMenu.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === state.sourceLang);
        });
        dom.clearInputBtn.classList.toggle('hidden', !dom.textInput.value);
    };

    let translationController;
    const handleTranslation = async () => {
        if (translationController) translationController.abort();
        translationController = new AbortController();
        const signal = translationController.signal;
        
        const textToTranslate = dom.textInput.value.trim();
        if (!textToTranslate) {
            dom.outputWrapper.innerHTML = '';
            state.lastDetectedLang = null;
            if (state.sourceLang !== 'auto') state.sourceLang = 'auto';
            updateUI();
            return;
        }

        dom.loadingIndicator.classList.remove('hidden');
        dom.outputWrapper.classList.add('translating');

        try {
            const response = await fetch('/translate', {
                method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: textToTranslate,
                    sourceLang: state.sourceLang,
                    targetLang: dom.targetLangSelect.value
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Server Error: ${response.status}`);

            let outputHTML = `<p class="translated-text">${data.translatedText}</p>`;
            if (data.romanization && config.needsRomanization.includes(dom.targetLangSelect.value)) {
                outputHTML += `<p class="romanization-text">${data.romanization}</p>`;
            }
            dom.outputWrapper.innerHTML = outputHTML;
            state.lastDetectedLang = data.detectedSourceLang;
            updateUI();
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Translation error:', error);
                dom.outputWrapper.innerHTML = `<p class="error-text"><strong>Gagal Menerjemahkan</strong><br>${error.message}</p>`;
            }
        } finally {
            dom.loadingIndicator.classList.add('hidden');
            dom.outputWrapper.classList.remove('translating');
        }
    };
    
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func(...args), delay); };
    };

    let notificationTimeout;
    const showCopyNotification = (message) => {
        clearTimeout(notificationTimeout);
        const notifText = dom.copyNotification.querySelector('span');
        notifText.textContent = message;
        dom.copyNotification.classList.remove('hidden');
        setTimeout(() => {
            dom.copyNotification.classList.add('show');
        }, 10);
        notificationTimeout = setTimeout(() => {
            dom.copyNotification.classList.remove('show');
            setTimeout(() => {
                dom.copyNotification.classList.add('hidden');
            }, 300);
        }, 2500);
    };

    const copyToClipboard = (text, type = 'Teks') => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            const message = type === 'Terjemahan' ? 'Terjemahan disalin' : 'Teks sumber disalin';
            showCopyNotification(message);
        }).catch(err => {
            console.error('Gagal menyalin teks: ', err);
            alert('Gagal menyalin teks ke clipboard.');
        });
    };
    
    const toggleMenu = (show) => {
        state.isMenuOpen = show;
        dom.sourceLangMenu.classList.toggle('hidden', !show);
        dom.sourceLangBtn.setAttribute('aria-expanded', show);
        if (show) {
            const rect = dom.sourceLangBtn.getBoundingClientRect();
            dom.sourceLangMenu.style.left = `${rect.left}px`;
            dom.sourceLangMenu.style.top = `${rect.bottom + 8}px`;
            dom.sourceLangMenu.style.width = `${rect.width}px`;
            const selected = dom.sourceLangMenu.querySelector('.selected') || dom.sourceLangMenu.firstElementChild;
            selected?.focus();
        }
    };

    const handleSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Maaf, browser Anda tidak mendukung fitur pengenalan suara.");
            dom.micBtn.disabled = true;
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = state.sourceLang === 'auto' ? 'id-ID' : state.sourceLang;
        recognition.onstart = () => {
            state.isListening = true;
            dom.micBtn.classList.add('listening');
        };
        recognition.onresult = (event) => {
            dom.textInput.value = event.results[0][0].transcript;
            updateUI();
            handleTranslation();
        };
        recognition.onerror = (event) => console.error("Speech recognition error", event.error);
        recognition.onend = () => {
            state.isListening = false;
            dom.micBtn.classList.remove('listening');
        };
        if (state.isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    };

    // --- SETUP EVENT LISTENERS ---
    const setupEventListeners = () => {
        populateDropdowns();
        
        dom.textInput.addEventListener('input', () => {
            updateUI();
            debounce(handleTranslation, 800)();
        });

        dom.targetLangSelect.addEventListener('change', () => {
            state.targetLang = dom.targetLangSelect.value;
            handleTranslation();
        });

        dom.clearInputBtn.addEventListener('click', () => {
            dom.textInput.value = '';
            dom.textInput.focus();
            handleTranslation();
        });

        dom.sourceLangBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu(!state.isMenuOpen);
        });

        dom.sourceLangMenu.addEventListener('click', (e) => {
            const target = e.target.closest('.dropdown-option');
            if (target) {
                state.sourceLang = target.dataset.value;
                toggleMenu(false);
                updateUI();
                handleTranslation();
            }
        });

        dom.swapBtn.addEventListener('click', () => {
            const sourceToSwitch = state.sourceLang === 'auto' ? state.lastDetectedLang : state.sourceLang;
            if (!sourceToSwitch || sourceToSwitch === 'auto') return;
            const targetToSwitch = dom.targetLangSelect.value;
            state.sourceLang = targetToSwitch;
            dom.targetLangSelect.value = sourceToSwitch;
            const tempInputText = dom.textInput.value;
            dom.textInput.value = dom.outputWrapper.querySelector('.translated-text')?.textContent.trim() || '';
            state.lastDetectedLang = targetToSwitch;
            updateUI();
            if(dom.textInput.value) {
                handleTranslation();
            } else {
                dom.outputWrapper.innerHTML = `<p class="translated-text">${tempInputText}</p>`;
            }
        });

        dom.micBtn.addEventListener('click', handleSpeechRecognition);

        document.addEventListener('click', (e) => {
            if (state.isMenuOpen && !e.target.closest('#source-lang-menu')) {
                toggleMenu(false);
            }
        });
        
        dom.copyInputBtn.addEventListener('click', () => copyToClipboard(dom.textInput.value, 'Teks sumber'));
        dom.copyOutputBtn.addEventListener('click', () => {
             const mainText = dom.outputWrapper.querySelector('.translated-text')?.textContent || '';
             copyToClipboard(mainText, 'Terjemahan');
        });
    };

    // --- INISIALISASI ---
    setupEventListeners();
});