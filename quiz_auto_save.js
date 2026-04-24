/**
 * QUIZ AUTO SAVER — Portale Didattico
 * Script da includere in ogni file quiz per salvare automaticamente i risultati su JSONBin.
 * 
 * INSTALLAZIONE:
 * Aggiungi in fondo al tuo quiz, prima di </body>:
 *   <script src="results_manager.js"></script>
 *   <script src="quiz_auto_save.js"></script>
 * 
 * Se il rilevamento automatico fallisce, chiama manualmente:
 *   manualSaveQuiz({ quizName: "Nome", score: 85, totalQuestions: 20, correctAnswers: 17 });
 */

(function() {
    'use strict';

    const CONFIG = {
        // Ritardo dopo il completamento del quiz prima di cercare i risultati (ms)
        SCAN_DELAY: 1500,
        // Selettori CSS dove cercare il punteggio
        SCORE_SELECTORS: [
            '[class*="score"]', '[class*="punteggio"]', '[class*="result"]', '[class*="risultato"]',
            '[id*="score"]', '[id*="punteggio"]', '[id*="result"]', '[id*="risultato"]',
            '.score', '.punteggio', '.result', '.risultato',
            '#score', '#punteggio', '#result', '#risultato'
        ],
        // Parole chiave nel testo che indicano il completamento
        COMPLETION_KEYWORDS: ['risultato', 'punteggio', 'score', 'completato', 'fine test', 'test completato', 'risultati'],
        // Parole chiave per pulsanti di invio/fine
        SUBMIT_KEYWORDS: ['invia', 'consegna', 'termina', 'fine', 'salva', 'invia risultati', 'send']
    };

    let hasSaved = false;
    let quizName = '';

    /**
     * Estrae il nome del quiz dal <title> o dall'h1
     */
    function detectQuizName() {
        const title = document.title || '';
        const h1 = document.querySelector('h1');
        const h2 = document.querySelector('h2');
        return title.replace(/Portale Didattico|Grammatica|Quiz|Test/gi, '').trim() 
            || (h1 && h1.textContent.trim()) 
            || (h2 && h2.textContent.trim())
            || 'Quiz senza nome';
    }

    /**
     * Cerca il punteggio nel DOM usando vari metodi
     */
    function findScore() {
        // Metodo 1: Cerca nei selettori CSS
        for (const sel of CONFIG.SCORE_SELECTORS) {
            const el = document.querySelector(sel);
            if (el) {
                const text = el.textContent || el.value || '';
                const parsed = parseScoreFromText(text);
                if (parsed !== null) return parsed;
            }
        }

        // Metodo 2: Cerca tutti gli elementi con testo numerico percentuale
        const allElements = document.querySelectorAll('span, div, p, h3, h4, strong, b, td');
        for (const el of allElements) {
            const text = el.textContent || '';
            // Cerca pattern tipo "85%", "17/20", "Punteggio: 85", "Risultato: 17 su 20"
            if (/\b(\d{1,3})\s*%/.test(text)) {
                const match = text.match(/\b(\d{1,3})\s*%/);
                if (match) return parseInt(match[1]);
            }
            if (/(\d{1,3})\s*[/\-]\s*(\d{1,3})/.test(text)) {
                const match = text.match(/(\d{1,3})\s*[/\-]\s*(\d{1,3})/);
                if (match) {
                    const num = parseInt(match[1]);
                    const den = parseInt(match[2]);
                    if (den > 0) return Math.round((num / den) * 100);
                }
            }
            if (/punteggio[:\s]+(\d{1,3})/i.test(text)) {
                const match = text.match(/punteggio[:\s]+(\d{1,3})/i);
                if (match) return parseInt(match[1]);
            }
        }

        // Metodo 3: Cerca in localStorage
        const possibleKeys = ['quiz_score', 'punteggio', 'score', 'result', 'risultato', 'test_score'];
        for (const key of possibleKeys) {
            const val = localStorage.getItem(key);
            if (val) {
                const num = parseInt(val);
                if (!isNaN(num) && num >= 0 && num <= 100) return num;
            }
        }

        return null;
    }

    function parseScoreFromText(text) {
        if (!text) return null;
        // "85%"
        let m = text.match(/\b(\d{1,3})\s*%/);
        if (m) return parseInt(m[1]);
        // "17/20"
        m = text.match(/(\d{1,3})\s*[/\-]\s*(\d{1,3})/);
        if (m) {
            const num = parseInt(m[1]), den = parseInt(m[2]);
            if (den > 0) return Math.round((num / den) * 100);
        }
        // Numero isolato 0-100
        m = text.match(/\b(\d{1,3})\b/);
        if (m) {
            const n = parseInt(m[1]);
            if (n >= 0 && n <= 100) return n;
        }
        return null;
    }

    /**
     * Cerca il numero totale di domande
     */
    function findTotalQuestions() {
        const text = document.body.innerText;
        const m = text.match(/(\d{1,3})\s*(domande|questions|items)/i);
        if (m) return parseInt(m[1]);
        // Cerca in elementi specifici
        const el = document.querySelector('[class*="total"], [id*="total"], [class*="domande"], [id*="domande"]');
        if (el) {
            const n = parseInt(el.textContent);
            if (!isNaN(n)) return n;
        }
        return 20; // default
    }

    /**
     * Cerca la durata
     */
    function findDuration() {
        // Cerca timer o durata
        const timerEl = document.querySelector('[class*="timer"], [id*="timer"], [class*="tempo"], [id*="tempo"]');
        if (timerEl) return timerEl.textContent.trim();
        return '';
    }

    /**
     * Salva il risultato automaticamente
     */
    function autoSave() {
        if (hasSaved) return;

        const score = findScore();
        if (score === null) {
            console.log('[QuizAutoSave] Punteggio non rilevato automaticamente. Usa manualSaveQuiz().');
            return;
        }

        const totalQuestions = findTotalQuestions();
        const correctAnswers = Math.round((score / 100) * totalQuestions);
        const wrongAnswers = totalQuestions - correctAnswers;

        const result = {
            quizName: detectQuizName(),
            score: score,
            totalQuestions: totalQuestions,
            correctAnswers: correctAnswers,
            wrongAnswers: wrongAnswers,
            duration: findDuration()
        };

        console.log('[QuizAutoSave] Risultato rilevato:', result);

        if (typeof saveQuizResult === 'function') {
            saveQuizResult(result).then(res => {
                if (res && res.success) {
                    hasSaved = true;
                    showSaveNotification('✅ Risultato salvato con successo!');
                } else {
                    showSaveNotification('⚠️ Errore salvataggio. Riprova con manualSaveQuiz().');
                }
            });
        } else {
            console.warn('[QuizAutoSave] saveQuizResult non disponibile. Assicurati di includere results_manager.js prima di quiz_auto_save.js');
        }
    }

    /**
     * Mostra notifica visiva
     */
    function showSaveNotification(message) {
        const existing = document.getElementById('quiz-save-notify');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.id = 'quiz-save-notify';
        div.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 99999;
            background: linear-gradient(135deg, #1e3a5f, #2c5282);
            color: white; padding: 15px 25px; border-radius: 12px;
            font-family: 'Source Sans Pro', sans-serif; font-size: 0.95em;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            animation: slideIn 0.4s ease;
        `;
        div.textContent = message;
        document.body.appendChild(div);

        setTimeout(() => {
            div.style.animation = 'slideOut 0.4s ease forwards';
            setTimeout(() => div.remove(), 400);
        }, 4000);
    }

    // Stili animazione
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
    `;
    document.head.appendChild(style);

    /**
     * Intercetta click su pulsanti di invio/fine
     */
    function attachSubmitListeners() {
        const buttons = document.querySelectorAll('button, input[type="submit"], a');
        buttons.forEach(btn => {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            if (CONFIG.SUBMIT_KEYWORDS.some(k => text.includes(k))) {
                btn.addEventListener('click', () => {
                    setTimeout(autoSave, CONFIG.SCAN_DELAY);
                });
            }
        });
    }

    /**
     * Intercetta cambiamento URL (per quiz SPA)
     */
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            setTimeout(autoSave, CONFIG.SCAN_DELAY);
        }
    }).observe(document, { subtree: true, childList: true });

    // Esponi funzione globale per salvataggio manuale
    window.manualSaveQuiz = function(data) {
        if (typeof saveQuizResult !== 'function') {
            console.error('[QuizAutoSave] results_manager.js non caricato!');
            return;
        }
        const result = {
            quizName: data.quizName || detectQuizName(),
            score: data.score || 0,
            totalQuestions: data.totalQuestions || 20,
            correctAnswers: data.correctAnswers || 0,
            wrongAnswers: data.wrongAnswers || 0,
            duration: data.duration || '',
            answers: data.answers || []
        };
        saveQuizResult(result).then(res => {
            if (res && res.success) {
                hasSaved = true;
                showSaveNotification('✅ Risultato salvato!');
            }
        });
    };

    // Inizializza
    document.addEventListener('DOMContentLoaded', () => {
        quizName = detectQuizName();
        attachSubmitListeners();

        // Se la pagina è già su risultati, prova subito
        const bodyText = document.body.innerText.toLowerCase();
        if (CONFIG.COMPLETION_KEYWORDS.some(k => bodyText.includes(k))) {
            setTimeout(autoSave, 1000);
        }
    });

})();
