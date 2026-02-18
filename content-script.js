// content-script.js - Dynamic Loader
// Завантажує актуальний код модифікацій з GitHub

(() => {
  'use strict';

  // === КОНФІГУРАЦІЯ ===
  // Замініть на свої значення після створення репозиторію
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

  // Завантаження коду з GitHub
  const fetchFromGitHub = async () => {
    log('Fetching modifications from GitHub...');
    
    try {
      const response = await fetch(RAW_URL, {
        cache: 'no-cache',
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

  // Виконання коду модифікацій
  const executeCode = (code) => {
    if (!code || typeof code !== 'string') {
      error('Invalid code to execute');
      return false;
    }

    try {
      log('Executing modification code...');
      // Створюємо функцію і виконуємо її
      const fn = new Function(code);
      fn();
      log('Modification code executed successfully');
      return true;
    } catch (e) {
      error('Failed to execute code:', e);
      return false;
    }
  };

  // Головна функція
  const main = async () => {
    log('Starting Dynamic Loader for:', location.href);

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

  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
