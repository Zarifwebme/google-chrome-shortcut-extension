import {
  getDefaultIconForUrl,
  getFaviconCandidates,
  applyCachedIconsToShortcuts,
  prefetchAndCacheFavicon
} from './favicon.js';

import {
  getShortcuts,
  findShortcutById,
  addShortcut,
  updateShortcutById,
  removeShortcutById
} from './storage.js';

document.addEventListener('DOMContentLoaded', function() {
  // DOM elementlarini olish
  const addFormOverlay = document.getElementById('addFormOverlay');
  const addForm = document.getElementById('addForm');
  const editFormOverlay = document.getElementById('editFormOverlay');
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

  // Saqlangan shortcutlarni yuklash
  renderShortcuts();

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

  // Add shortcut formasini (markazlashtirilgan modal sifatida) ko'rsatish
  function openAddForm() {
    closeEditForm();
    addFormOverlay.classList.add('show');
  }

  // Add shortcut modalini yopish
  function closeAddForm() {
    addFormOverlay.classList.remove('show');
  }

  function resetAddForm() {
    shortcutTitle.value = '';
    shortcutUrl.value = '';
  }

  // Edit shortcut modalini yopish
  function closeEditForm() {
    editFormOverlay.classList.remove('show');
  }

  function resetEditForm() {
    editShortcutTitle.value = '';
    editShortcutUrl.value = '';
    editShortcutId.value = '';
  }

  // "Cancel" tugmasi bosilganda formani yashirish
  cancelBtn.addEventListener('click', function() {
    closeAddForm();
    resetAddForm();
  });

  // "Cancel Edit" tugmasi bosilganda edit formani yashirish
  cancelEditBtn.addEventListener('click', function() {
    closeEditForm();
    resetEditForm();
  });

  // Overlay (modal tashqarisiga) bosilganda formani yashirish
  addFormOverlay.addEventListener('click', function(event) {
    if (event.target === addFormOverlay) {
      closeAddForm();
      resetAddForm();
    }
  });

  editFormOverlay.addEventListener('click', function(event) {
    if (event.target === editFormOverlay) {
      closeEditForm();
      resetEditForm();
    }
  });

  // Escape tugmasi bosilganda ochiq modalni yopish
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') {
      return;
    }
    if (addFormOverlay.classList.contains('show')) {
      closeAddForm();
      resetAddForm();
    }
    if (editFormOverlay.classList.contains('show')) {
      closeEditForm();
      resetEditForm();
    }
  });

  // "Save" tugmasi bosilganda shortcut yaratish
  saveShortcutBtn.addEventListener('click', function() {
    const title = shortcutTitle.value.trim();
    let url = shortcutUrl.value.trim();

    if (title === '' || url === '') {
      alert('Iltimos, barcha maydonlarni to\'ldiring!');
      return;
    }

    url = ensureUrlHasScheme(url);

    // Shortcut yaratishdan oldin faviconni mahalliy keshga tayyorlaymiz.
    // Natija shortcut yozuviga emas, faqat mahalliy keshga yoziladi (sync xotira
    // hajmi cheklangan), keyingi render'da applyCachedIconsToShortcuts uni oladi.
    prefetchAndCacheFavicon(url, title, function() {
      addShortcut(title, url, '', renderShortcuts);
    });

    // Formani tozalash va yashirish
    resetAddForm();
    closeAddForm();
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

    url = ensureUrlHasScheme(url);

    // Yangilashdan oldin yangi URL/title uchun faviconni mahalliy keshga tayyorlaymiz.
    prefetchAndCacheFavicon(url, title, function() {
      updateShortcutById(id, title, url, '', renderShortcuts);
    });

    // Formani tozalash va yashirish
    resetEditForm();
    closeEditForm();
  });

  // URLga http:// yoki https:// qo'shish, agar mavjud bo'lmasa
  function ensureUrlHasScheme(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'https://' + url;
    }
    return url;
  }

  // Saqlangan shortcutlarni (keshlangan ikonkalar bilan) grid'da qayta chizadi
  function renderShortcuts() {
    getShortcuts(function(shortcuts) {
      applyCachedIconsToShortcuts(shortcuts, function(shortcutsWithCachedIcons) {
        shortcutsGrid.innerHTML = '';
        shortcutsWithCachedIcons.forEach(addShortcutToGrid);
        addAddShortcutTile();
      });
    });
  }

  // Shortcutni tahrirlash uchun formani to'ldirish
  function openEditForm(id) {
    findShortcutById(id, function(shortcut) {
      if (!shortcut) {
        return;
      }

      editShortcutId.value = shortcut.id;
      editShortcutTitle.value = shortcut.title;
      editShortcutUrl.value = shortcut.url;

      closeAddForm();
      editFormOverlay.classList.add('show');
    });
  }

  // Shortcutni grid'ga qo'shish
  function addShortcutToGrid(shortcut) {
    const shortcutElement = document.createElement('div');
    shortcutElement.className = 'shortcut';
    shortcutElement.dataset.id = shortcut.id;

    // Bir nechta manbadan favicon olishga harakat qilamiz (darhol ko'rsatish uchun taxminiy zanjir).
    const faviconCandidates = getFaviconCandidates(shortcut.url);
    const fallbackIcon = getDefaultIconForUrl(shortcut.url, shortcut.title);
    // Mahalliy keshdan kelgan haqiqiy favicon data: URL ko'rinishida bo'ladi -
    // shu holatdagina tarmoqqa hech qanday murojaat kerak emasligini bildiradi.
    const isCachedFavicon = Boolean(shortcut.icon) && shortcut.icon.startsWith('data:');
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
    let faviconIndex = isCachedFavicon ? faviconCandidates.length : 0;

    iconImage.addEventListener('error', function() {
      faviconIndex += 1;

      if (faviconIndex < faviconCandidates.length) {
        this.src = faviconCandidates[faviconIndex];
        return;
      }

      this.src = fallbackIcon;
    });

    // Agar mahalliy keshda hali haqiqiy (data:) favicon bo'lmasa, uni fonda bir marta
    // aniqlab, keshga saqlaymiz - shu bilan keyingi barcha ochilishlar tarmoqsiz bo'ladi.
    if (!isCachedFavicon) {
      prefetchAndCacheFavicon(shortcut.url, shortcut.title, function(resolvedIcon) {
        iconImage.src = resolvedIcon;
      });
    }

    iconElement.addEventListener('click', function() {
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
      openEditForm(id);
      dropdownMenu.classList.remove('show');
    });

    // O'chirish tugmasi funksionaligi
    const removeBtn = shortcutElement.querySelector('.remove-shortcut');
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = parseInt(shortcutElement.dataset.id);
      const confirmDelete = confirm('Ushbu shortcutni o\'chirishni istaysizmi?');
      if (confirmDelete) {
        removeShortcutById(id, renderShortcuts);
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
});
