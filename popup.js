document.addEventListener('DOMContentLoaded', function() {
  const FAVICON_CACHE_KEY = 'faviconCache';
  const FAVICON_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 kun

    // DOM elementlarini olish
    const addForm = document.getElementById('addForm');
    const editForm = document.getElementById('editForm');
    const cancelBtn = document.getElementById('cancelBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const saveShortcutBtn = document.getElementById('saveShortcutBtn');
    const updateShortcutBtn = document.getElementById('updateShortcutBtn');
    const shortcutTitle = document.getElementById('shortcutTitle');
    const shortcutUrl = document.getElementById('shortcutUrl');
    const editShortcutTitle = document.getElementById('editShortcutTitle');
    const editShortcutUrl = document.getElementById('editShortcutUrl');
    const editShortcutId = document.getElementById('editShortcutId');
    const shortcutsGrid = document.getElementById('shortcutsGrid');
    
    const DEFAULT_SHORTCUTS = [
      {
        id: 1,
        title: 'YouTube',
        url: 'https://www.youtube.com'
      },
      {
        id: 2,
        title: 'GitHub',
        url: 'https://github.com'
      },
      {
        id: 3,
        title: 'LinkedIn',
        url: 'https://www.linkedin.com'
      }
    ];

    // Saqlangan shortcutlarni yuklash
    loadShortcuts();
    
    // Ochiq menularni yopish uchun document click event
    document.addEventListener('click', function(event) {
      const dropdowns = document.querySelectorAll('.dropdown-menu.show');
      dropdowns.forEach(function(dropdown) {
        if (!dropdown.contains(event.target) && 
            !event.target.classList.contains('shortcut-menu') && 
            !event.target.classList.contains('shortcut-menu-dots')) {
          dropdown.classList.remove('show');
        }
      });
    });
    
    // Add shortcut formasini ko'rsatish
    function openAddForm() {
      addForm.style.display = 'block';
      editForm.style.display = 'none';
    }
    
    // "Cancel" tugmasi bosilganda formani yashirish
    cancelBtn.addEventListener('click', function() {
      addForm.style.display = 'none';
      shortcutTitle.value = '';
      shortcutUrl.value = '';
    });
    
    // "Cancel Edit" tugmasi bosilganda edit formani yashirish
    cancelEditBtn.addEventListener('click', function() {
      editForm.style.display = 'none';
      editShortcutTitle.value = '';
      editShortcutUrl.value = '';
      editShortcutId.value = '';
    });
    
    // "Save" tugmasi bosilganda shortcut yaratish
    saveShortcutBtn.addEventListener('click', function() {
      const title = shortcutTitle.value.trim();
      let url = shortcutUrl.value.trim();
      
      if (title === '' || url === '') {
        alert('Iltimos, barcha maydonlarni to\'ldiring!');
        return;
      }
      
      // URLga http:// yoki https:// qo'shish, agar mavjud bo'lmasa
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Shortcut yaratishdan oldin faviconni cachega tayyorlaymiz
      prefetchAndCacheFavicon(url, title, function(cachedIcon) {
        createShortcut(title, url, cachedIcon);
      });
      
      // Formani tozalash va yashirish
      shortcutTitle.value = '';
      shortcutUrl.value = '';
      addForm.style.display = 'none';
    });
    
    // "Update" tugmasi bosilganda shortcutni yangilash
    updateShortcutBtn.addEventListener('click', function() {
      const id = parseInt(editShortcutId.value);
      const title = editShortcutTitle.value.trim();
      let url = editShortcutUrl.value.trim();
      
      if (title === '' || url === '' || isNaN(id)) {
        alert('Iltimos, barcha maydonlarni to\'ldiring!');
        return;
      }
      
      // URLga http:// yoki https:// qo'shish, agar mavjud bo'lmasa
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Yangilashdan oldin yangi URL/title uchun faviconni cachega tayyorlaymiz
      prefetchAndCacheFavicon(url, title, function(cachedIcon) {
        updateShortcut(id, title, url, cachedIcon);
      });
      
      // Formani tozalash va yashirish
      editShortcutTitle.value = '';
      editShortcutUrl.value = '';
      editShortcutId.value = '';
      editForm.style.display = 'none';
    });
    
    // Shortcutlarni yuklash funksiyasi
    function loadShortcuts() {
      chrome.storage.sync.get(['shortcuts', 'defaultsInitialized'], function(data) {
        const shortcuts = data.shortcuts || [];
        const defaultsInitialized = Boolean(data.defaultsInitialized);

        // Default shortcutlarni faqat bir marta qo'yish
        if (!defaultsInitialized) {
          if (!shortcuts.length) {
            chrome.storage.sync.set({
              shortcuts: DEFAULT_SHORTCUTS,
              defaultsInitialized: true
            }, function() {
              loadShortcuts();
            });
            return;
          }

          // Agar userda allaqachon shortcut bo'lsa, default init flagini qo'yib ketamiz
          chrome.storage.sync.set({ defaultsInitialized: true }, function() {
            loadShortcuts();
          });
          return;
        }
        
        applyCachedIconsToShortcuts(shortcuts, function(shortcutsWithCachedIcons) {
          // Barcha shortcutlarni ko'rsatish
          shortcutsGrid.innerHTML = '';
          shortcutsWithCachedIcons.forEach(function(shortcut) {
            addShortcutToGrid(shortcut);
          });
          addAddShortcutTile();
        });
      });
    }
    
    // Yangi shortcut yaratish va saqlash
    function createShortcut(title, url, icon) {
      const shortcut = {
        id: Date.now(), // Unique ID
        title: title,
        url: url,
        icon: icon || ''
      };
      
      // Mavjud shortcutlarni olish va yangi shortcut qo'shish
      chrome.storage.sync.get('shortcuts', function(data) {
        const shortcuts = data.shortcuts || [];
        shortcuts.push(shortcut);
        
        // Yangilangan ro'yxatni saqlash
        chrome.storage.sync.set({shortcuts: shortcuts}, function() {
          // Tartibni saqlash uchun ro'yxatni qayta chizish
          loadShortcuts();
        });
      });
    }
    
    // Shortcutni yangilash funksiyasi
    function updateShortcut(id, title, url, icon) {
      chrome.storage.sync.get('shortcuts', function(data) {
        const shortcuts = data.shortcuts || [];
        
        // Shortcutni topish va yangilash
        const updatedShortcuts = shortcuts.map(function(shortcut) {
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
        
        // Yangilangan ro'yxatni saqlash
        chrome.storage.sync.set({shortcuts: updatedShortcuts}, function() {
          // Barcha shortcutlarni qayta yuklash
          loadShortcuts();
        });
      });
    }
    
    // Shortcutni o'chirish funksiyasi
    function removeShortcut(id) {
      chrome.storage.sync.get('shortcuts', function(data) {
        const shortcuts = data.shortcuts || [];
        
        // Shortcutni ro'yxatdan o'chirish
        const updatedShortcuts = shortcuts.filter(function(shortcut) {
          return shortcut.id !== id;
        });
        
        // Yangilangan ro'yxatni saqlash
        chrome.storage.sync.set({shortcuts: updatedShortcuts}, function() {
          // Barcha shortcutlarni qayta yuklash
          loadShortcuts();
        });
      });
    }
    
    // Shortcutni tahrirlash uchun formani to'ldirish
    function editShortcut(id) {
      chrome.storage.sync.get('shortcuts', function(data) {
        const shortcuts = data.shortcuts || [];
        
        // Shortcutni topish
        const shortcut = shortcuts.find(function(shortcut) {
          return shortcut.id === id;
        });
        
        if (shortcut) {
          // Edit formani to'ldirish
          editShortcutId.value = shortcut.id;
          editShortcutTitle.value = shortcut.title;
          editShortcutUrl.value = shortcut.url;
          
          // Edit formani ko'rsatish
          addForm.style.display = 'none';
          editForm.style.display = 'block';
        }
      });
    }
    
    // Shortcutni grid'ga qo'shish
    function addShortcutToGrid(shortcut) {
      const shortcutElement = document.createElement('div');
      shortcutElement.className = 'shortcut';
      shortcutElement.dataset.id = shortcut.id;
      
      // Bir nechta manbadan favicon olishga harakat qilamiz.
      const faviconCandidates = getFaviconCandidates(shortcut.url);
      const fallbackIcon = getDefaultIconForUrl(shortcut.url, shortcut.title);
      const initialIcon = shortcut.icon || faviconCandidates[0] || fallbackIcon;
      
      shortcutElement.innerHTML = `
        <div class="shortcut-icon" data-url="${shortcut.url}">
          <img src="${initialIcon}" alt="${shortcut.title}">
        </div>
        <div class="shortcut-title">${shortcut.title}</div>
        <div class="shortcut-menu">
          <div class="shortcut-menu-dots">⋮</div>
          <div class="dropdown-menu">
            <div class="dropdown-item edit-shortcut">Edit shortcut</div>
            <div class="dropdown-item remove-shortcut">Remove</div>
          </div>
        </div>
      `;
      
      // Shortcut bosilganda saytni ochish
      const iconElement = shortcutElement.querySelector('.shortcut-icon');
      const iconImage = shortcutElement.querySelector('.shortcut-icon img');
      let faviconIndex = shortcut.icon ? faviconCandidates.length : 0;

      iconImage.addEventListener('error', function() {
        faviconIndex += 1;

        if (faviconIndex < faviconCandidates.length) {
          this.src = faviconCandidates[faviconIndex];
          return;
        }

        this.src = fallbackIcon;
      });

      // Agar shortcutda icon yo'q bo'lsa, birinchi muvaffaqiyatli ikonani saqlab qo'yamiz.
      if (!shortcut.icon) {
        iconImage.addEventListener('load', function() {
          const loadedSrc = this.currentSrc || this.src;
          cacheFaviconByUrl(shortcut.url, loadedSrc, function() {
            persistShortcutIcon(shortcut.id, loadedSrc);
          });
        }, { once: true });
      }

      iconElement.addEventListener('click', function(e) {
        const url = this.getAttribute('data-url');
        chrome.tabs.create({ url: url });
      });
      
      // Menu tugmasi bosilganda dropdown menuni ko'rsatish
      const menuBtn = shortcutElement.querySelector('.shortcut-menu');
      const dropdownMenu = shortcutElement.querySelector('.dropdown-menu');
      
      menuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        // Boshqa ochiq menularni yopish
        document.querySelectorAll('.dropdown-menu.show').forEach(function(menu) {
          if (menu !== dropdownMenu) {
            menu.classList.remove('show');
          }
        });
        // Menu ko'rsatish/yashirish
        dropdownMenu.classList.toggle('show');
      });
      
      // Edit tugmasi funksionaligi
      const editBtn = shortcutElement.querySelector('.edit-shortcut');
      editBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(shortcutElement.dataset.id);
        editShortcut(id);
        dropdownMenu.classList.remove('show');
      });
      
      // O'chirish tugmasi funksionaligi
      const removeBtn = shortcutElement.querySelector('.remove-shortcut');
      removeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = parseInt(shortcutElement.dataset.id);
        const confirmDelete = confirm('Ushbu shortcutni o\'chirishni istaysizmi?');
        if (confirmDelete) {
          removeShortcut(id);
        }
        dropdownMenu.classList.remove('show');
      });
      
      shortcutsGrid.appendChild(shortcutElement);
    }

    function addAddShortcutTile() {
      const addShortcutElement = document.createElement('div');
      addShortcutElement.className = 'shortcut add-shortcut';
      addShortcutElement.innerHTML = `
        <div class="shortcut-icon" role="button" aria-label="Add shortcut">
          <span class="add-plus">+</span>
        </div>
        <div class="shortcut-title">Add shortcut</div>
      `;

      addShortcutElement.addEventListener('click', function() {
        openAddForm();
      });

      shortcutsGrid.appendChild(addShortcutElement);
    }

    function getDefaultIconForUrl(url, title) {
      let hostname = '';

      try {
        hostname = new URL(url).hostname.toLowerCase();
      } catch (error) {
        hostname = '';
      }

      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        return createIconSvg('#ff0000', 'YT');
      }

      if (hostname.includes('github.com')) {
        return createIconSvg('#24292f', 'GH');
      }

      const safeTitle = (title || 'W').trim();
      const label = safeTitle ? safeTitle.charAt(0).toUpperCase() : 'W';
      return createIconSvg('#4285f4', label);
    }

    function getFaviconCandidates(url) {
      try {
        const parsedUrl = new URL(url);
        const origin = parsedUrl.origin;
        const hostname = parsedUrl.hostname;

        return [
          `${origin}/favicon.ico`,
          `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
          `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origin)}&sz=64`
        ];
      } catch (error) {
        return [];
      }
    }

    function createIconSvg(bgColor, label) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bgColor}"/><text x="32" y="39" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700">${label}</text></svg>`;
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function getFaviconCacheKey(url) {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch (error) {
        return '';
      }
    }

    function getCachedFaviconByUrl(url, callback) {
      const cacheKey = getFaviconCacheKey(url);
      if (!cacheKey) {
        callback('');
        return;
      }

      chrome.storage.local.get(FAVICON_CACHE_KEY, function(data) {
        const cache = data[FAVICON_CACHE_KEY] || {};
        const cachedItem = cache[cacheKey];

        if (!cachedItem || !cachedItem.src || !cachedItem.savedAt) {
          callback('');
          return;
        }

        const isExpired = (Date.now() - cachedItem.savedAt) > FAVICON_CACHE_TTL_MS;
        if (isExpired) {
          delete cache[cacheKey];
          chrome.storage.local.set({ [FAVICON_CACHE_KEY]: cache }, function() {
            callback('');
          });
          return;
        }

        callback(cachedItem.src);
      });
    }

    function applyCachedIconsToShortcuts(shortcuts, callback) {
      // Bu render paytida keraksiz qayta so'rovlarni kamaytiradi.
      chrome.storage.local.get(FAVICON_CACHE_KEY, function(data) {
        const cacheSnapshot = data[FAVICON_CACHE_KEY] || {};

        const mergedShortcuts = shortcuts.map(function(shortcut) {
          if (shortcut.icon) {
            return shortcut;
          }

          const cacheKey = getFaviconCacheKey(shortcut.url);
          const cachedItem = cacheSnapshot[cacheKey];

          if (!cachedItem || !cachedItem.src || !cachedItem.savedAt) {
            return shortcut;
          }

          const isExpired = (Date.now() - cachedItem.savedAt) > FAVICON_CACHE_TTL_MS;
          if (isExpired) {
            return shortcut;
          }

          return {
            id: shortcut.id,
            title: shortcut.title,
            url: shortcut.url,
            icon: cachedItem.src
          };
        });

        callback(mergedShortcuts);
      });
    }

    function cacheFaviconByUrl(url, src, callback) {
      const cacheKey = getFaviconCacheKey(url);
      if (!cacheKey || !src) {
        if (callback) {
          callback();
        }
        return;
      }

      chrome.storage.local.get(FAVICON_CACHE_KEY, function(data) {
        const cache = data[FAVICON_CACHE_KEY] || {};
        cache[cacheKey] = {
          src: src,
          savedAt: Date.now()
        };

        chrome.storage.local.set({ [FAVICON_CACHE_KEY]: cache }, function() {
          if (callback) {
            callback();
          }
        });
      });
    }

    function persistShortcutIcon(id, iconSrc) {
      chrome.storage.sync.get('shortcuts', function(data) {
        const shortcuts = data.shortcuts || [];
        const updatedShortcuts = shortcuts.map(function(shortcut) {
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

        chrome.storage.sync.set({ shortcuts: updatedShortcuts });
      });
    }

    function prefetchAndCacheFavicon(url, title, callback) {
      getCachedFaviconByUrl(url, function(cachedSrc) {
        if (cachedSrc) {
          callback(cachedSrc);
          return;
        }

        const candidates = getFaviconCandidates(url);
        const fallbackIcon = getDefaultIconForUrl(url, title);

        loadFirstAvailableImage(candidates, function(bestSrc) {
          const finalSrc = bestSrc || fallbackIcon;

          cacheFaviconByUrl(url, finalSrc, function() {
            callback(finalSrc);
          });
        });
      });
    }

    function loadFirstAvailableImage(srcList, callback) {
      if (!srcList || !srcList.length) {
        callback('');
        return;
      }

      let index = 0;

      function tryNext() {
        if (index >= srcList.length) {
          callback('');
          return;
        }

        const src = srcList[index];
        index += 1;

        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.onload = function() {
          callback(src);
        };
        img.onerror = function() {
          tryNext();
        };
        img.src = src;
      }

      tryNext();
    }
  });