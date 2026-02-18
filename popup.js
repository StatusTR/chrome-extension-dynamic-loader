// popup.js - Popup UI Controller

(() => {
  'use strict';

  // DOM Elements
  const masterToggle = document.getElementById('masterToggle');
  const statusBadge = document.getElementById('statusBadge');
  const modificationsList = document.getElementById('modificationsList');
  const refreshBtn = document.getElementById('refreshBtn');
  const reloadPageBtn = document.getElementById('reloadPageBtn');
  const lastUpdateEl = document.getElementById('lastUpdate');
  const modCountEl = document.getElementById('modCount');
  const toast = document.getElementById('toast');

  // Default state
  const DEFAULT_STATE = {
    enabled: true,
    modifications: {},
    lastUpdate: null
  };

  // Show toast notification
  const showToast = (message, isError = false) => {
    toast.textContent = message;
    toast.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Load state from storage
  const loadState = async () => {
    try {
      const result = await chrome.storage.sync.get(['extensionState']);
      return result.extensionState || DEFAULT_STATE;
    } catch (e) {
      console.error('Failed to load state:', e);
      return DEFAULT_STATE;
    }
  };

  // Save state to storage
  const saveState = async (state) => {
    try {
      await chrome.storage.sync.set({ extensionState: state });
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  };

  // Update status badge
  const updateStatusBadge = (enabled) => {
    if (enabled) {
      statusBadge.textContent = 'Активно';
      statusBadge.className = 'status-badge active';
    } else {
      statusBadge.textContent = 'Вимкнено';
      statusBadge.className = 'status-badge inactive';
    }
  };

  // Render modifications list
  const renderModifications = (modifications, state) => {
    if (!modifications || modifications.length === 0) {
      modificationsList.innerHTML = '<div class="empty-state">Модифікації не завантажені</div>';
      modCountEl.textContent = '0';
      return;
    }

    modCountEl.textContent = modifications.length;

    modificationsList.innerHTML = modifications.map(mod => `
      <div class="mod-item" data-mod-id="${mod.id}">
        <div class="mod-info">
          <div class="mod-name">${mod.name}</div>
          <div class="mod-desc">${mod.description}</div>
        </div>
        <label class="switch mod-switch">
          <input type="checkbox" class="mod-toggle" data-mod-id="${mod.id}" 
                 ${state.modifications[mod.id] !== false ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    `).join('');

    // Add event listeners for modification toggles
    document.querySelectorAll('.mod-toggle').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const modId = e.target.dataset.modId;
        const currentState = await loadState();
        currentState.modifications[modId] = e.target.checked;
        await saveState(currentState);
        
        // Notify content script
        notifyContentScript({ type: 'TOGGLE_MODIFICATION', modId, enabled: e.target.checked });
        
        showToast(e.target.checked ? 'Модифікацію увімкнено' : 'Модифікацію вимкнено');
      });
    });
  };

  // Get cached modifications from local storage
  const getCachedModifications = () => {
    try {
      const cached = localStorage.getItem('cached_modifications_meta');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  };

  // Cache modifications metadata
  const cacheModifications = (modifications) => {
    try {
      localStorage.setItem('cached_modifications_meta', JSON.stringify(modifications));
    } catch (e) {
      console.error('Failed to cache modifications:', e);
    }
  };

  // Fetch modifications from GitHub
  const fetchModifications = async () => {
    const CONFIG = {
      GITHUB_USER: 'StatusTR',
      REPO_NAME: 'chrome-extension-dynamic-loader',
      BRANCH: 'main',
      FILE_PATH: 'modifications.js'
    };

    const RAW_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.REPO_NAME}/${CONFIG.BRANCH}/${CONFIG.FILE_PATH}`;

    try {
      const response = await fetch(RAW_URL + '?t=' + Date.now(), {
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const code = await response.text();
      
      // Extract modifications metadata from the code
      const modificationsMatch = code.match(/const\s+MODIFICATIONS\s*=\s*(\[\s*\{[\s\S]*?\}\s*\]);/);
      
      if (modificationsMatch) {
        try {
          // Safe eval for the modifications array
          const modifications = eval(modificationsMatch[1]);
          return modifications;
        } catch (e) {
          console.error('Failed to parse modifications:', e);
        }
      }
      
      // Fallback - return basic structure
      return [{
        id: 'default',
        name: 'Стандартні модифікації',
        description: 'Базовий набір модифікацій'
      }];

    } catch (e) {
      console.error('Failed to fetch modifications:', e);
      return null;
    }
  };

  // Notify content script about changes
  const notifyContentScript = async (message) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, message);
      }
    } catch (e) {
      console.error('Failed to notify content script:', e);
    }
  };

  // Force refresh from GitHub
  const forceRefresh = async () => {
    refreshBtn.disabled = true;
    const originalContent = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<div class="spinner"></div> Оновлення...';

    try {
      const modifications = await fetchModifications();
      
      if (modifications) {
        cacheModifications(modifications);
        const state = await loadState();
        state.lastUpdate = Date.now();
        await saveState(state);
        
        renderModifications(modifications, state);
        lastUpdateEl.textContent = formatDate(state.lastUpdate);
        
        // Notify content script to reload
        notifyContentScript({ type: 'FORCE_REFRESH' });
        
        showToast('Успішно оновлено з GitHub!');
      } else {
        showToast('Помилка завантаження', true);
      }
    } catch (e) {
      showToast('Помилка: ' + e.message, true);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = originalContent;
    }
  };

  // Reload current page
  const reloadCurrentPage = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.reload(tab.id);
      window.close();
    }
  };

  // Initialize popup
  const init = async () => {
    // Load state
    const state = await loadState();

    // Set master toggle
    masterToggle.checked = state.enabled;
    updateStatusBadge(state.enabled);
    lastUpdateEl.textContent = formatDate(state.lastUpdate);

    // Load modifications (cached first, then fetch)
    let modifications = getCachedModifications();
    
    if (modifications) {
      renderModifications(modifications, state);
    }

    // Fetch fresh modifications
    const freshModifications = await fetchModifications();
    if (freshModifications) {
      cacheModifications(freshModifications);
      renderModifications(freshModifications, state);
    } else if (!modifications) {
      modificationsList.innerHTML = '<div class="empty-state">Не вдалося завантажити модифікації</div>';
    }

    // Event listeners
    masterToggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      const currentState = await loadState();
      currentState.enabled = enabled;
      await saveState(currentState);
      updateStatusBadge(enabled);
      
      // Notify content script
      notifyContentScript({ type: 'TOGGLE_MASTER', enabled });
      
      showToast(enabled ? 'Модифікації увімкнено' : 'Модифікації вимкнено');
    });

    refreshBtn.addEventListener('click', forceRefresh);
    reloadPageBtn.addEventListener('click', reloadCurrentPage);
  };

  // Start
  init();
})();
