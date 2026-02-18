// modifications.js - Код модифікацій сторінки v2.0
// Цей файл зберігається на GitHub і автоматично підтягується розширенням
// При зміні цього файлу - оновлення застосовуються автоматично!

// === СТРУКТУРА МОДИФІКАЦІЙ ===
// Кожна модифікація має: id, name, description, type, code
// Types: 'text', 'number', 'element', 'hide', 'style'

const MODIFICATIONS = [
  {
    id: 'postbank-balance',
    name: 'Postbank баланс',
    description: 'Змінює баланс на 110.202,41 EUR',
    type: 'number',
    enabled: true,
    config: {
      selector: 'span.db-text--highlight.positive > span:first-child',
      newValue: '110.202,41'
    }
  },
  {
    id: 'balance-modifier',
    name: 'Зміна балансу',
    description: 'Додає суму до балансу рахунку',
    type: 'number',
    config: {
      increment: 100854.98,
      selector: 'db-banking-decorated-amount .balance span:not([data-test="currencyCode"])'
    }
  },
  {
    id: 'title-modifier',
    name: 'Зміна заголовка',
    description: 'Змінює текст заголовка сторінки',
    type: 'text',
    config: {
      selector: 'h1, .page-title',
      find: 'Financial Overview',
      replace: 'My Portfolio'
    }
  },
  {
    id: 'hide-ads',
    name: 'Приховати рекламу',
    description: 'Приховує рекламні банери',
    type: 'hide',
    config: {
      selectors: ['.ad-banner', '.promo-block', '[data-ad]']
    }
  },
  {
    id: 'custom-styles',
    name: 'Кастомні стилі',
    description: 'Додає власні CSS стилі',
    type: 'style',
    config: {
      css: `
        .balance { font-weight: bold !important; }
        .account-card { border-radius: 12px !important; }
      `
    }
  },
  {
    id: 'add-element',
    name: 'Додати елемент',
    description: 'Додає власний елемент на сторінку',
    type: 'element',
    config: {
      targetSelector: '.header, header',
      position: 'beforeend',
      html: '<div class="custom-badge" style="background:#22c55e;color:white;padding:4px 8px;border-radius:4px;font-size:12px;">✓ Verified</div>'
    }
  }
]; // END_MODIFICATIONS

// === ГОЛОВНИЙ КОД ВИКОНАННЯ ===

(() => {
  'use strict';

  // Перевірка, що ми на потрібній сторінці
  if (location.origin !== "https://banking.postbank.de") return;
  if (!location.hash.startsWith("#/banking/financial-overview")) return;

  // Отримуємо стан з батьківського контексту (якщо доступний)
  const getState = () => {
    try {
      return typeof extensionState !== 'undefined' ? extensionState : { enabled: true, modifications: {} };
    } catch {
      return { enabled: true, modifications: {} };
    }
  };

  // Перевірка чи модифікація увімкнена
  const checkEnabled = (modId) => {
    const state = getState();
    if (!state.enabled) return false;
    return state.modifications[modId] !== false;
  };

  console.log('[Modifications] Starting with state:', getState());

  // === УТИЛІТИ ===

  // Парсинг німецького формату: "2.620,76" → 2620.76
  const parseEuro = (txt) => {
    if (!txt) return NaN;
    const norm = txt.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(norm);
  };

  // Форматування: 103475.74 → "103.475,74"
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

  // === МОДИФІКАТОРИ ЗА ТИПАМИ ===

  // Тип: number - Зміна чисел/балансів
  const applyNumberModification = (mod) => {
    if (!checkEnabled(mod.id)) return false;
    
    const { increment, selector, newValue } = mod.config;
    const ssKey = `mod-${mod.id}:${location.hash}`;
    
    const loadMap = () => {
      try { return JSON.parse(sessionStorage.getItem(ssKey) || '{}'); }
      catch { return {}; }
    };
    
    const saveMap = (m) => {
      try { sessionStorage.setItem(ssKey, JSON.stringify(m)); }
      catch {}
    };

    let changed = false;
    const map = loadMap();
    const bumpedSet = new Set(Object.values(map));

    document.querySelectorAll(selector).forEach((el) => {
      const curText = (el.textContent || '').trim();
      if (!curText) return;
      
      // Якщо є newValue - пряма заміна на фіксоване значення
      if (newValue !== undefined) {
        if (curText !== newValue && !curText.startsWith(newValue)) {
          el.textContent = newValue + ' ';
          changed = true;
        }
        return;
      }
      
      // Якщо increment - додавання до поточного значення
      if (bumpedSet.has(curText)) return;

      if (map[curText]) {
        el.textContent = map[curText] + ' ';
        changed = true;
        return;
      }

      const curVal = parseEuro(curText);
      if (!isFinite(curVal)) return;

      const newVal = curVal + increment;
      const formatted = formatEuro(newVal);
      
      if (formatted && formatted !== curText) {
        el.textContent = formatted + ' ';
        map[curText] = formatted;
        changed = true;
      }
    });

    if (changed) saveMap(map);
    return changed;
  };

  // Тип: text - Зміна тексту
  const applyTextModification = (mod) => {
    if (!checkEnabled(mod.id)) return false;
    
    const { selector, find, replace } = mod.config;
    let changed = false;

    document.querySelectorAll(selector).forEach((el) => {
      if (el.textContent.includes(find)) {
        el.textContent = el.textContent.replace(find, replace);
        changed = true;
      }
    });

    return changed;
  };

  // Тип: hide - Приховування елементів
  const applyHideModification = (mod) => {
    if (!checkEnabled(mod.id)) return false;
    
    const { selectors } = mod.config;
    let changed = false;

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el.style.display !== 'none') {
          el.style.display = 'none';
          changed = true;
        }
      });
    });

    return changed;
  };

  // Тип: style - Додавання CSS стилів
  const applyStyleModification = (mod) => {
    if (!checkEnabled(mod.id)) return false;
    
    const styleId = `mod-style-${mod.id}`;
    if (document.getElementById(styleId)) return false;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = mod.config.css;
    document.head.appendChild(style);
    return true;
  };

  // Тип: element - Додавання елементів
  const applyElementModification = (mod) => {
    if (!checkEnabled(mod.id)) return false;
    
    const { targetSelector, position, html } = mod.config;
    const markerId = `mod-element-${mod.id}`;
    
    if (document.getElementById(markerId)) return false;

    const target = document.querySelector(targetSelector);
    if (!target) return false;

    const wrapper = document.createElement('div');
    wrapper.id = markerId;
    wrapper.innerHTML = html;

    target.insertAdjacentElement(position || 'beforeend', wrapper);
    return true;
  };

  // === ГОЛОВНИЙ АПЛІКАТОР ===

  const applyModification = (mod) => {
    switch (mod.type) {
      case 'number': return applyNumberModification(mod);
      case 'text': return applyTextModification(mod);
      case 'hide': return applyHideModification(mod);
      case 'style': return applyStyleModification(mod);
      case 'element': return applyElementModification(mod);
      default: return false;
    }
  };

  const applyAllModifications = () => {
    let anyChanged = false;
    
    MODIFICATIONS.forEach(mod => {
      try {
        if (applyModification(mod)) {
          anyChanged = true;
          console.log(`[Modifications] Applied: ${mod.name}`);
        }
      } catch (e) {
        console.error(`[Modifications] Error applying ${mod.name}:`, e);
      }
    });

    return anyChanged;
  };

  // === SPA ПІДТРИМКА ===

  const withRetries = (fn, delays = [0, 200, 500, 1000, 2000, 3500]) => {
    let done = false;
    delays.forEach((d) => {
      setTimeout(() => {
        if (done) return;
        try { if (fn()) done = true; } catch {}
      }, d);
    });
  };

  const hookHashChange = () => {
    window.addEventListener('hashchange', () => {
      if (location.hash.startsWith("#/banking/financial-overview")) {
        withRetries(applyAllModifications);
      }
    });
  };

  let debounceTimer = null;
  const scheduleApply = (delay = 300) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyAllModifications(), delay);
  };

  const startObserver = () => {
    const obs = new MutationObserver(() => scheduleApply(300));
    obs.observe(document.body, { childList: true, subtree: true });
  };

  // === ІНІЦІАЛІЗАЦІЯ ===

  const init = () => {
    console.log('[Modifications] Initializing v2.0...');
    console.log('[Modifications] State:', getState());
    console.log('[Modifications] Modifications count:', MODIFICATIONS.length);
    
    withRetries(applyAllModifications);
    hookHashChange();
    startObserver();
    
    console.log('[Modifications] Initialization complete');
  };

  // Запуск
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
