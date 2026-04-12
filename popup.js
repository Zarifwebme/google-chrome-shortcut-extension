document.addEventListener('DOMContentLoaded', function() {
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
      
      // Shortcut yaratish
      createShortcut(title, url);
      
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
      
      // Shortcutni yangilash
      updateShortcut(id, title, url);
      
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
        
        // Barcha shortcutlarni ko'rsatish
        shortcutsGrid.innerHTML = '';
        shortcuts.forEach(function(shortcut) {
          addShortcutToGrid(shortcut);
        });
        addAddShortcutTile();
      });
    }
    
    // Yangi shortcut yaratish va saqlash
    function createShortcut(title, url) {
      const shortcut = {
        id: Date.now(), // Unique ID
        title: title,
        url: url
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
    function updateShortcut(id, title, url) {
      chrome.storage.sync.get('shortcuts', function(data) {
        const shortcuts = data.shortcuts || [];
        
        // Shortcutni topish va yangilash
        const updatedShortcuts = shortcuts.map(function(shortcut) {
          if (shortcut.id === id) {
            return {
              id: id,
              title: title,
              url: url
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
      
      // Favicon URL ni aniqlash
      const urlObj = new URL(shortcut.url);
      const faviconUrl = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(urlObj.origin)}&sz=64`;
      const fallbackIcon = getDefaultIconForUrl(shortcut.url, shortcut.title);
      
      shortcutElement.innerHTML = `
        <div class="shortcut-icon" data-url="${shortcut.url}">
          <img src="${faviconUrl}" alt="${shortcut.title}">
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

      iconImage.addEventListener('error', function() {
        this.src = fallbackIcon;
      }, { once: true });

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

    function createIconSvg(bgColor, label) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bgColor}"/><text x="32" y="39" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700">${label}</text></svg>`;
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }
  });