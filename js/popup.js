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
  const addFormError = document.getElementById('addFormError');
  const editFormError = document.getElementById('editFormError');
  const shortcutsGrid = document.getElementById('shortcutsGrid');
  const confirmDeleteOverlay = document.getElementById('confirmDeleteOverlay');
  const confirmDeleteYesBtn = document.getElementById('confirmDeleteYesBtn');
  const confirmDeleteNoBtn = document.getElementById('confirmDeleteNoBtn');
  let pendingDeleteId = null;

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
        const card = dropdown.closest('.shortcut');
        if (card) {
          card.classList.remove('menu-open');
        }
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
    clearFormError(addFormError);
  }

  // Edit shortcut modalini yopish
  function closeEditForm() {
    editFormOverlay.classList.remove('show');
  }

  function resetEditForm() {
    editShortcutTitle.value = '';
    editShortcutUrl.value = '';
    editShortcutId.value = '';
    clearFormError(editFormError);
  }

  // Forma xatosi xabarini ko'rsatish/yashirish
  function showFormError(errorElement, message) {
    errorElement.textContent = message;
    errorElement.hidden = false;
  }

  function clearFormError(errorElement) {
    errorElement.textContent = '';
    errorElement.hidden = true;
  }

  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Sarlavha/URL maydonlarini tekshiradi va xato bo'lsa inline xabar ko'rsatadi.
  // Muvaffaqiyatli bo'lsa, tozalangan { title, url } obyektini qaytaradi.
  function getValidatedShortcutInput(rawTitle, rawUrl, errorElement) {
    const title = rawTitle.trim();
    const url = rawUrl.trim();

    if (title === '' || url === '') {
      showFormError(errorElement, 'Iltimos, sarlavha va URL manzilini kiriting.');
      return null;
    }

    const normalizedUrl = ensureUrlHasScheme(url);
    if (!isValidUrl(normalizedUrl)) {
      showFormError(errorElement, 'Iltimos, yaroqli URL manzil kiriting (masalan: example.com).');
      return null;
    }

    clearFormError(errorElement);
    return { title: title, url: normalizedUrl };
  }

  // O'chirishni tasdiqlash dialogini ko'rsatish
  function openConfirmDelete(id) {
    pendingDeleteId = id;
    closeAddForm();
    closeEditForm();
    confirmDeleteOverlay.classList.add('show');
    confirmDeleteNoBtn.focus();
  }

  // O'chirishni tasdiqlash dialogini yopish
  function closeConfirmDelete() {
    confirmDeleteOverlay.classList.remove('show');
    pendingDeleteId = null;
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

  // Overlay (dialog tashqarisiga) bosilganda tasdiqlash dialogini yashirish
  confirmDeleteOverlay.addEventListener('click', function(event) {
    if (event.target === confirmDeleteOverlay) {
      closeConfirmDelete();
    }
  });

  // "Yo'q" tugmasi bosilganda o'chirishni bekor qilish
  confirmDeleteNoBtn.addEventListener('click', function() {
    closeConfirmDelete();
  });

  // "Ha" tugmasi bosilganda shortcutni o'chirish
  confirmDeleteYesBtn.addEventListener('click', function() {
    if (pendingDeleteId !== null) {
      removeShortcutById(pendingDeleteId, renderShortcuts);
    }
    closeConfirmDelete();
  });

  // Escape tugmasi bosilganda ochiq modalni yopish
  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') {
      return;
    }
    if (confirmDeleteOverlay.classList.contains('show')) {
      closeConfirmDelete();
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

  // "Save" tugmasi bosilganda shortcut yaratish.
  // Yozish darhol (tarmoq so'rovlarini kutmasdan) amalga oshiriladi: popup oynasi
  // fokusni yo'qotgan zahoti Chrome uni yopib, tugallanmagan async ishlarni bekor
  // qiladi - shu sababli favicon aniqlanguncha (bir necha soniya) kutish yozishni
  // "jimgina" muvaffaqiyatsizlikka olib kelardi. Favicon esa keyingi renderShortcuts()
  // chaqiruvida addShortcutToGrid() orqali fonda avtomatik aniqlanadi.
  saveShortcutBtn.addEventListener('click', function() {
    const input = getValidatedShortcutInput(shortcutTitle.value, shortcutUrl.value, addFormError);
    if (!input) {
      return;
    }

    addShortcut(input.title, input.url, '', function(error) {
      if (error) {
        showFormError(addFormError, 'Saqlashda xatolik yuz berdi. Qaytadan urinib ko\'ring.');
        return;
      }
      resetAddForm();
      closeAddForm();
      renderShortcuts();
    });
  });

  // "Update" tugmasi bosilganda shortcutni yangilash (izoh: saveShortcutBtn
  // bilan bir xil sababga ko'ra yozish favicon aniqlanishini kutmaydi).
  updateShortcutBtn.addEventListener('click', function() {
    const id = parseInt(editShortcutId.value);
    const validated = getValidatedShortcutInput(editShortcutTitle.value, editShortcutUrl.value, editFormError);

    if (isNaN(id)) {
      showFormError(editFormError, 'Ichki xatolik: shortcut aniqlanmadi.');
      return;
    }

    if (!validated) {
      return;
    }

    updateShortcutById(id, validated.title, validated.url, '', function(error) {
      if (error) {
        showFormError(editFormError, 'Saqlashda xatolik yuz berdi. Qaytadan urinib ko\'ring.');
        return;
      }
      resetEditForm();
      closeEditForm();
      renderShortcuts();
    });
  });

  // URLga http:// yoki https:// qo'shish, agar mavjud bo'lmasa
  function ensureUrlHasScheme(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'https://' + url;
    }
    return url;
  }

  // Dropdown menuni ochishdan oldin uning popup chegarasidan tashqariga
  // chiqib ketmasligini ta'minlaydi. Standart holatda menu chapdan o'ngga
  // ochiladi (left: 0); agar shu holatda popup'ning o'ng chetidan tashqariga
  // chiqib ketsa, .align-end klassi orqali o'ngdan chapga ochilishga o'zgartiriladi.
  function positionDropdownMenu(trigger, menu) {
    const triggerRect = trigger.getBoundingClientRect();
    const menuWidth = menu.offsetWidth;
    const viewportWidth = document.documentElement.clientWidth;
    const wouldOverflowRight = (triggerRect.left + menuWidth) > viewportWidth;

    menu.classList.toggle('align-end', wouldOverflowRight);
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
      clearFormError(editFormError);

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
          const otherCard = menu.closest('.shortcut');
          if (otherCard) {
            otherCard.classList.remove('menu-open');
          }
        }
      });

      const isOpening = !dropdownMenu.classList.contains('show');
      if (isOpening) {
        positionDropdownMenu(menuBtn, dropdownMenu);
      }
      // Menu ko'rsatish/yashirish
      dropdownMenu.classList.toggle('show');
      // Faol kartani qo'shni kartalar ustiga chiqarish (z-index) uchun
      shortcutElement.classList.toggle('menu-open', dropdownMenu.classList.contains('show'));
    });

    // Edit tugmasi funksionaligi
    const editBtn = shortcutElement.querySelector('.edit-shortcut');
    editBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = parseInt(shortcutElement.dataset.id);
      openEditForm(id);
      dropdownMenu.classList.remove('show');
      shortcutElement.classList.remove('menu-open');
    });

    // O'chirish tugmasi funksionaligi
    const removeBtn = shortcutElement.querySelector('.remove-shortcut');
    removeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = parseInt(shortcutElement.dataset.id);
      dropdownMenu.classList.remove('show');
      shortcutElement.classList.remove('menu-open');
      openConfirmDelete(id);
    });

    shortcutsGrid.appendChild(shortcutElement);
  }

  function addAddShortcutTile() {
    const addShortcutElement = document.createElement('div');
    addShortcutElement.className = 'shortcut add-shortcut';
    addShortcutElement.innerHTML = `
      <div class="shortcut-icon" role="button" aria-label="Add shortcut">
        <svg class="add-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </div>
      <div class="shortcut-title">Add shortcut</div>
    `;

    addShortcutElement.addEventListener('click', function() {
      openAddForm();
    });

    shortcutsGrid.appendChild(addShortcutElement);
  }
});
