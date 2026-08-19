import { DEFAULT_SHORTCUTS } from './constants.js';

// "shortcuts" ro'yxatini o'qib, uni transform() orqali o'zgartirib, qayta saqlaydi.
// create/update/remove/persist-icon barchasi shu bitta o'qi-o'zgartir-yoz naqshini takrorlaydi edi.
function mutateShortcuts(transform, callback) {
  chrome.storage.sync.get('shortcuts', function(data) {
    const shortcuts = data.shortcuts || [];
    const updatedShortcuts = transform(shortcuts);

    chrome.storage.sync.set({ shortcuts: updatedShortcuts }, function() {
      // chrome.storage.sync.set() bajaruvchi callback har doim chaqiriladi,
      // hatto kvota chegarasi kabi xatolarda ham - shuning uchun xatoni
      // chrome.runtime.lastError orqali chaqiruvchiga uzatamiz.
      if (callback) {
        callback(chrome.runtime.lastError || null);
      }
    });
  });
}

// Shortcutlarni yuklaydi; birinchi ishga tushirishda default shortcutlarni bir marta joylaydi.
export function getShortcuts(callback) {
  chrome.storage.sync.get(['shortcuts', 'defaultsInitialized'], function(data) {
    const shortcuts = data.shortcuts || [];
    const defaultsInitialized = Boolean(data.defaultsInitialized);

    if (!defaultsInitialized) {
      if (!shortcuts.length) {
        chrome.storage.sync.set({
          shortcuts: DEFAULT_SHORTCUTS,
          defaultsInitialized: true
        }, function() {
          getShortcuts(callback);
        });
        return;
      }

      chrome.storage.sync.set({ defaultsInitialized: true }, function() {
        getShortcuts(callback);
      });
      return;
    }

    callback(shortcuts);
  });
}

export function findShortcutById(id, callback) {
  chrome.storage.sync.get('shortcuts', function(data) {
    const shortcuts = data.shortcuts || [];
    const shortcut = shortcuts.find(function(item) {
      return item.id === id;
    });
    callback(shortcut);
  });
}

export function addShortcut(title, url, icon, callback) {
  const shortcut = {
    id: Date.now(), // Unique ID
    title: title,
    url: url,
    icon: icon || ''
  };

  mutateShortcuts(function(shortcuts) {
    shortcuts.push(shortcut);
    return shortcuts;
  }, callback);
}

export function updateShortcutById(id, title, url, icon, callback) {
  mutateShortcuts(function(shortcuts) {
    return shortcuts.map(function(shortcut) {
      if (shortcut.id === id) {
        return {
          id: id,
          title: title,
          url: url,
          icon: icon || shortcut.icon || ''
        };
      }
      return shortcut;
    });
  }, callback);
}

export function removeShortcutById(id, callback) {
  mutateShortcuts(function(shortcuts) {
    return shortcuts.filter(function(shortcut) {
      return shortcut.id !== id;
    });
  }, callback);
}

// Favicon birinchi marta muvaffaqiyatli yuklanganda uni doimiy saqlab qo'yadi.
export function persistShortcutIcon(id, iconSrc) {
  mutateShortcuts(function(shortcuts) {
    return shortcuts.map(function(shortcut) {
      if (shortcut.id === id) {
        return {
          id: shortcut.id,
          title: shortcut.title,
          url: shortcut.url,
          icon: iconSrc
        };
      }
      return shortcut;
    });
  });
}
