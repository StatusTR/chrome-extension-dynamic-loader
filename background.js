// background.js - Service Worker
// Handles communication between popup and content scripts

(() => {
  'use strict';

  // Default extension state
  const DEFAULT_STATE = {
    enabled: true,
    modifications: {},
    lastUpdate: null
  };

  // Initialize state on install
  chrome.runtime.onInstalled.addListener(async () => {
    console.log('[Background] Extension installed');
    
    // Set default state if not exists
    const result = await chrome.storage.sync.get(['extensionState']);
    if (!result.extensionState) {
      await chrome.storage.sync.set({ extensionState: DEFAULT_STATE });
      console.log('[Background] Default state initialized');
    }
  });

  // Handle messages from popup or content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Message received:', message);

    switch (message.type) {
      case 'GET_STATE':
        chrome.storage.sync.get(['extensionState']).then(result => {
          sendResponse(result.extensionState || DEFAULT_STATE);
        });
        return true; // Will respond asynchronously

      case 'SET_STATE':
        chrome.storage.sync.set({ extensionState: message.state }).then(() => {
          sendResponse({ success: true });
        });
        return true;

      case 'FORCE_REFRESH':
        // Broadcast to all content scripts
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { type: 'FORCE_REFRESH' }).catch(() => {});
            }
          });
        });
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  });

  // Handle tab updates (for applying modifications on navigation)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      // Check if this is a target URL
      if (tab.url.includes('banking.postbank.de')) {
        const result = await chrome.storage.sync.get(['extensionState']);
        const state = result.extensionState || DEFAULT_STATE;
        
        // Notify content script about current state
        try {
          await chrome.tabs.sendMessage(tabId, { 
            type: 'STATE_UPDATE', 
            state: state 
          });
        } catch (e) {
          // Content script might not be ready yet
          console.log('[Background] Content script not ready yet');
        }
      }
    }
  });

  console.log('[Background] Service worker started');
})();
