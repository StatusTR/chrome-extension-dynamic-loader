// content-script.js - Dynamic Loader v2.0
// Завантажує актуальний код модифікацій з GitHub з підтримкою UI управління

(() => {
  'use strict';

  // === КОНФІГУРАЦІЯ ===
  const CONFIG = {
    GITHUB_USER: 'StatusTR',
    REPO_NAME: 'chrome-extension-dynamic-loader',
    BRANCH: 'main',
    FILE_PATH: 'modifications.js',
    CACHE_DURATION_MS: 5 * 60 * 1000, // 5 хвилин кешування
    DEBUG: true
  };

  const RAW_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.REPO_NAME}/${CONFIG.BRANCH}/${CONFIG.FILE_PATH}`;

  const log = (...args) => {
    if (CONFIG.DEBUG) console.log('[DynamicLoader]', ...args);
  };

  const error = (...args) => {
    console.error('[DynamicLoader]', ...args);
  };

  // Глобальний стан
  let extensionState = {
    enabled: true,
    modifications: {}
  };

  let loadedModifications = [];
  let observerActive = false;
  let mutationObserver = null;

  // === STORAGE FUNCTIONS ===
  
  // Завантаження стану з chrome.storage
  const loadExtensionState = async () => {
    try {
      const result = await chrome.storage.sync.get(['extensionState']);
      if (result.extensionState) {
        extensionState = result.extensionState;
        log('State loaded:', extensionState);
      }
      return extensionState;
    } catch (e) {
      error('Failed to load state:', e);
      return extensionState;
    }
  };

  // === CACHE FUNCTIONS ===

  // Перевірка кешу
  const getCachedCode = () => {
    try {
      const cached = localStorage.getItem('dynamic_loader_cache');
      if (!cached) return null;
      
      const { code, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      if (age < CONFIG.CACHE_DURATION_MS) {
        log('Using cached code (age:', Math.round(age / 1000), 'seconds)');
        return code;
      }
      log('Cache expired');
      return null;
    } catch (e) {
      return null;
    }
  };

  // Збереження в кеш
  const setCachedCode = (code) => {
    try {
      localStorage.setItem('dynamic_loader_cache', JSON.stringify({
        code,
        timestamp: Date.now()
      }));
    } catch (e) {
      error('Failed to cache code:', e);
    }
  };

  // Очищення кешу
  const clearCache = () => {
    try {
      localStorage.removeItem('dynamic_loader_cache');
      log('Cache cleared');
    } catch (e) {
      error('Failed to clear cache:', e);
    }
  };

  // === GITHUB FETCH ===

  // Завантаження коду з GitHub
  const fetchFromGitHub = async (bustCache = false) => {
    log('Fetching modifications from GitHub...');
    
    try {
      const url = bustCache ? `${RAW_URL}?t=${Date.now()}` : RAW_URL;
      const response = await fetch(url, {
        cache: bustCache ? 'no-cache' : 'default',
        headers: {
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const code = await response.text();
      log('Successfully loaded', code.length, 'bytes from GitHub');
      return code;
    } catch (e) {
      error('Failed to fetch from GitHub:', e);
      return null;
    }
  };

  // === CODE EXECUTION ===

  // Парсинг модифікацій з коду
  const parseModifications = (code) => {
    try {
      // Шукаємо масив MODIFICATIONS
      const match = code.match(/const\s+MODIFICATIONS\s*=\s*(\[[\s\S]*?\]);\s*\/\/ END_MODIFICATIONS/);
      if (match) {
        const modificationsCode = match[1];
        const modifications = eval(modificationsCode);
        return modifications;
      }
      return [];
    } catch (e) {
      error('Failed to parse modifications:', e);
      return [];
    }
  };

  // Перевірка чи модифікація увімкнена
  const isModificationEnabled = (modId) => {
    // Якщо головний перемикач вимкнено - всі модифікації вимкнені
    if (!extensionState.enabled) return false;
    
    // Перевіряємо індивідуальний стан модифікації
    // За замовчуванням модифікації увімкнені
    return extensionState.modifications[modId] !== false;
  };

  // Виконання коду модифікацій
  const executeCode = (code) => {
    if (!code || typeof code !== 'string') {
      error('Invalid code to execute');
      return false;
    }

    // Якщо розширення вимкнено - не виконуємо
    if (!extensionState.enabled) {
      log('Extension disabled, skipping execution');
      return false;
    }

    try {
      log('Executing modification code...');
      
      // Парсимо модифікації
      loadedModifications = parseModifications(code);
      log('Found', loadedModifications.length, 'modifications');

      // Передаємо стан в виконуваний код
      const wrappedCode = `
        (function(extensionState, isModificationEnabled) {
          ${code}
        })(${JSON.stringify(extensionState)}, ${isModificationEnabled.toString()});
      `;

      // Створюємо функцію і виконуємо її
      const fn = new Function('extensionState', 'isModificationEnabled', code);
      fn(extensionState, isModificationEnabled);
      
      log('Modification code executed successfully');
      return true;
    } catch (e) {
      error('Failed to execute code:', e);
      return false;
    }
  };

  // === MAIN FUNCTIONS ===

  // Головна функція
  const main = async () => {
    log('Starting Dynamic Loader v2.0 for:', location.href);

    // Завантажуємо стан
    await loadExtensionState();

    // Якщо вимкнено - виходимо
    if (!extensionState.enabled) {
      log('Extension is disabled');
      return;
    }

    // Спочатку пробуємо з кешу (для швидкого відображення)
    const cachedCode = getCachedCode();
    if (cachedCode) {
      executeCode(cachedCode);
    }

    // Паралельно завантажуємо свіжий код з GitHub
    const freshCode = await fetchFromGitHub();
    
    if (freshCode) {
      // Якщо код відрізняється від кешованого - оновлюємо
      if (freshCode !== cachedCode) {
        log('New code detected, updating...');
        setCachedCode(freshCode);
        
        // Якщо не було кешованого - виконуємо свіжий
        if (!cachedCode) {
          executeCode(freshCode);
        }
      }
    } else if (!cachedCode) {
      error('No cached code and failed to fetch from GitHub');
    }
  };

  // Примусове оновлення
  const forceRefresh = async () => {
    log('Force refresh requested');
    clearCache();
    
    const freshCode = await fetchFromGitHub(true);
    if (freshCode) {
      setCachedCode(freshCode);
      // Перезавантажуємо сторінку для чистого застосування
      location.reload();
    }
  };

  // === MESSAGE HANDLING ===

  // Слухаємо повідомлення від popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log('Message received:', message);

    switch (message.type) {
      case 'TOGGLE_MASTER':
        extensionState.enabled = message.enabled;
        if (message.enabled) {
          // Перезапускаємо модифікації
          main();
        } else {
          // Перезавантажуємо сторінку для скидання змін
          location.reload();
        }
        sendResponse({ success: true });
        break;

      case 'TOGGLE_MODIFICATION':
        extensionState.modifications[message.modId] = message.enabled;
        // Перезавантажуємо для застосування змін
        location.reload();
        sendResponse({ success: true });
        break;

      case 'FORCE_REFRESH':
        forceRefresh();
        sendResponse({ success: true });
        break;

      case 'STATE_UPDATE':
        extensionState = message.state;
        log('State updated from background');
        sendResponse({ success: true });
        break;

      case 'GET_MODIFICATIONS':
        sendResponse({ modifications: loadedModifications });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }

    return true; // Keep message channel open for async response
  });

  // === INITIALIZATION ===

  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
