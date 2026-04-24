/**
 * RESULTS MANAGER - Portale Didattico
 * Script da includere in ogni quiz/test per salvare i risultati su JSONBin
 * 
 * USO:
 * 1. Includi questo script nel tuo quiz: <script src="results_manager.js"></script>
 * 2. Alla fine del test, chiama:
 *    saveQuizResult({
 *        quizName: "Nome del Quiz",
 *        score: 85,              // punteggio percentuale
 *        totalQuestions: 20,
 *        correctAnswers: 17,
 *        wrongAnswers: 3,
 *        duration: "00:12:45",   // formato HH:MM:SS
 *        answers: [              // opzionale - array delle risposte
 *            { question: "Domanda 1", userAnswer: "A", correctAnswer: "B", isCorrect: false },
 *            ...
 *        ]
 *    });
 */

const RESULTS_CONFIG = {
    BIN_ID: '69ebca0936566621a8eabdc7',           // <-- SOSTITUISCI con il tuo Bin ID
    API_KEY: '$2a$10$mZ.qMlZMju3bJxDm7vY69u31zv0HwAPxAqBfdfa.Wn25oUJQ76coa',    // <-- SOSTITUISCI con la tua Master Key
    BASE_URL: 'https://api.jsonbin.io/v3/b'
};

/**
 * Recupera i dati utente corrente da localStorage (salvato da index.html)
 */
function getCurrentUser() {
    const raw = localStorage.getItem('portaleUser');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch(e) {
        return { fullName: raw, nome: raw, cognome: '', email: '' };
    }
}

/**
 * Genera ID univoco
 */
function generateId(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Legge i dati dal bin JSONBin
 */
async function getBinData() {
    try {
        const res = await fetch(`${RESULTS_CONFIG.BASE_URL}/${RESULTS_CONFIG.BIN_ID}/latest`, {
            headers: {
                'X-Master-Key': RESULTS_CONFIG.API_KEY,
                'X-Bin-Meta': 'false'
            }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (e) {
        console.error('[ResultsManager] Errore lettura:', e);
        return null;
    }
}

/**
 * Scrive i dati aggiornati nel bin
 */
async function updateBinData(data) {
    try {
        const res = await fetch(`${RESULTS_CONFIG.BASE_URL}/${RESULTS_CONFIG.BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': RESULTS_CONFIG.API_KEY
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (e) {
        console.error('[ResultsManager] Errore scrittura:', e);
        return null;
    }
}

/**
 * Salva il risultato di un quiz su JSONBin
 * @param {Object} result - Oggetto con i dati del risultato
 */
async function saveQuizResult(result) {
    const user = getCurrentUser();
    if (!user) {
        console.warn('[ResultsManager] Nessun utente loggato. Risultato non salvato.');
        return { success: false, error: 'Utente non loggato' };
    }

    if (!RESULTS_CONFIG.BIN_ID || RESULTS_CONFIG.BIN_ID.includes('TUO')) {
        console.warn('[ResultsManager] JSONBin non configurato.');
        return { success: false, error: 'Configurazione mancante' };
    }

    const record = {
        id: generateId('res'),
        userId: localStorage.getItem('portale_user_id') || generateId('usr'),
        userName: user.fullName || (user.nome + ' ' + user.cognome).trim(),
        userEmail: user.email || '',
        quizName: result.quizName || 'Quiz senza nome',
        score: result.score || 0,
        totalQuestions: result.totalQuestions || 0,
        correctAnswers: result.correctAnswers || 0,
        wrongAnswers: result.wrongAnswers || 0,
        duration: result.duration || '',
        answers: result.answers || [],
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent.substring(0, 100)
    };

    const data = await getBinData();
    if (!data) return { success: false, error: 'Impossibile leggere dati' };

    if (!data.results) data.results = [];
    data.results.push(record);

    // Mantieni solo ultimi 500 risultati per non esaurire il piano gratuito
    if (data.results.length > 500) {
        data.results = data.results.slice(-500);
    }

    data.updatedAt = new Date().toISOString();

    const updated = await updateBinData(data);
    if (updated) {
        console.log('[ResultsManager] Risultato salvato:', record.id);
        return { success: true, record: record };
    }
    return { success: false, error: 'Errore scrittura' };
}

/**
 * Salva il risultato in localStorage come backup (se JSONBin fallisce)
 */
function saveResultLocal(result) {
    const user = getCurrentUser();
    const record = {
        id: generateId('res'),
        userName: user ? (user.fullName || user.nome) : 'Anonimo',
        userEmail: user ? user.email : '',
        quizName: result.quizName || 'Quiz',
        score: result.score || 0,
        totalQuestions: result.totalQuestions || 0,
        correctAnswers: result.correctAnswers || 0,
        wrongAnswers: result.wrongAnswers || 0,
        duration: result.duration || '',
        timestamp: new Date().toISOString()
    };
    const key = 'portale_results_backup';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(record);
    localStorage.setItem(key, JSON.stringify(existing));
    return record;
}

/**
 * Funzione di utilità: formatta durata da secondi a HH:MM:SS
 */
function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// Esporta funzioni globali
window.saveQuizResult = saveQuizResult;
window.saveResultLocal = saveResultLocal;
window.formatDuration = formatDuration;
