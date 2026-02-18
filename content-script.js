// content-script.js
(() => {
  'use strict';

  // Перевірка, що ми на потрібній сторінці
  if (location.origin !== "https://banking.postbank.de") return;
  if (!location.hash.startsWith("#/banking/financial-overview")) return;

  const INCREMENT = 100854.98; // +100 854,98 EUR

  // Парсинг німецького формату: "2.620,76" → 2620.76
  const parseEuro = (txt) => {
    if (!txt) return NaN;
    const norm = txt.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(norm);
  };

  // Форматування назад: 103475.74 → "103.475,74"
  const formatEuro = (num) => {
    if (!isFinite(num)) return '';
    const isNeg = num < 0;
    const abs = Math.abs(num);
    const parts = abs.toFixed(2).split('.');
    const intPart = parts[0];
    const decPart = parts[1];
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (isNeg ? '-' : '') + `${withSep},${decPart}`;
  };

  // Ключ для sessionStorage (щоб не додавати +100k кілька разів до одного оригіналу)
  const ssKey = () => `postbank-bumped:${location.hash}`;
  const loadMap = () => { 
    try { return JSON.parse(sessionStorage.getItem(ssKey()) || '{}'); } 
    catch { return {}; } 
  };
  const saveMap = (m) => { 
    try { sessionStorage.setItem(ssKey(), JSON.stringify(m)); } 
    catch {} 
  };

  // Основна функція: знаходимо всі <db-banking-decorated-amount> і міняємо суму
  const bumpAllBalances = () => {
    let changed = false;
    const map = loadMap(); // orig -> bumped
    const bumpedSet = new Set(Object.values(map));

    // Шукаємо всі компоненти з балансом
    document.querySelectorAll('db-banking-decorated-amount').forEach((component) => {
      // Всередині шукаємо <span> з сумою (перший <span> всередині .balance)
      const balanceSpan = component.querySelector('.balance span:not([data-test="currencyCode"])');
      if (!balanceSpan) return;

      const curText = (balanceSpan.textContent || '').trim();
      if (!curText) return;

      // Якщо вже підняте — пропускаємо
      if (bumpedSet.has(curText)) return;

      // Якщо це оригінал, який ми вже бачили раніше — підставляємо збережене
      if (map[curText]) {
        balanceSpan.textContent = map[curText] + ' '; // пробіл для форматування
        changed = true;
        return;
      }

      // Нове оригінальне значення — парсимо і додаємо INCREMENT
      const curVal = parseEuro(curText);
      if (!isFinite(curVal)) return;

      const newVal = curVal + INCREMENT;
      const formatted = formatEuro(newVal);
      
      if (formatted && formatted !== curText) {
        balanceSpan.textContent = formatted + ' '; // пробіл для форматування
        map[curText] = formatted;
        changed = true;
      }
    });

    if (changed) saveMap(map);
    return changed;
  };

  // Застосування змін
  const apply = () => {
    try {
      return bumpAllBalances();
    } catch (e) {
      console.error('Postbank balance bump error:', e);
      return false;
    }
  };

  // Повторні спроби (для SPA, коли DOM завантажується поступово)
  const withRetries = (fn, delays = [0, 200, 500, 1000, 2000, 3500]) => {
    let done = false;
    delays.forEach((d) => {
      setTimeout(() => {
        if (done) return;
        try { if (fn()) done = true; } catch {}
      }, d);
    });
  };

  // Хук для SPA-навігації (hash-зміни)
  const hookHashChange = () => {
    window.addEventListener('hashchange', () => {
      if (location.hash.startsWith("#/banking/financial-overview")) {
        withRetries(apply);
      }
    });
  };

  // MutationObserver для динамічних змін DOM
  let debounceTimer = null;
  const scheduleApply = (delay = 300) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => apply(), delay);
  };

  const startObserver = () => {
    const obs = new MutationObserver(() => scheduleApply(300));
    obs.observe(document.body, { childList: true, subtree: true });
  };

  // Ініціалізація
  const init = () => {
    withRetries(apply);
    hookHashChange();
    startObserver();
  };

  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
