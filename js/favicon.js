import { FAVICON_CACHE_KEY, FAVICON_CACHE_TTL_MS, FAVICON_FETCH_TIMEOUT_MS } from './constants.js';

// Shortcut nomi/URL asosida rangli, harfli SVG ikonka yasaydi.
function createIconSvg(bgColor, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bgColor}"/><text x="32" y="39" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// Barcha favicon manbalari muvaffaqiyatsiz bo'lganda ko'rsatiladigan zaxira ikonka.
export function getDefaultIconForUrl(url, title) {
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

// Sinab ko'riladigan favicon manbalari, ustuvorlik tartibida.
export function getFaviconCandidates(url) {
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

// rel atributi qaysi turdagi ikonani bildirishini aniqlaydi (kichikroq raqam = ustuvorroq).
// Token tartibidan qat'i nazar ishlaydi: "icon", "shortcut icon", "ICON shortcut" va h.k.
function getIconRelRank(relAttribute) {
  const tokens = (relAttribute || '').toLowerCase().trim().split(/\s+/);

  if (tokens.includes('apple-touch-icon-precomposed')) {
    return 3;
  }
  if (tokens.includes('apple-touch-icon')) {
    return 2;
  }
  if (tokens.includes('icon')) {
    return tokens.includes('shortcut') ? 1 : 0;
  }

  return -1;
}

// SVG formatini ustun qo'yadi - istalgan o'lchamda aniq ko'rinadi.
function getIconTypeScore(linkElement) {
  const type = (linkElement.getAttribute('type') || '').toLowerCase();
  return type.includes('svg') ? 1 : 0;
}

// "sizes" atributidan eng katta o'lchamni o'qiydi (32x32, 64x64, "any" ...).
function getIconSizeScore(linkElement) {
  const sizesAttr = (linkElement.getAttribute('sizes') || '').toLowerCase();

  if (sizesAttr === 'any') {
    return Number.MAX_SAFE_INTEGER;
  }

  const match = sizesAttr.match(/(\d+)x\d+/);
  return match ? parseInt(match[1], 10) : 0;
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(function() {
    controller.abort();
  }, timeoutMs);

  return fetch(url, { signal: controller.signal, redirect: 'follow' })
    .finally(function() {
      clearTimeout(timeoutId);
    });
}

// Sahifa HTML'ini yuklab, <link rel="icon">, "shortcut icon", "apple-touch-icon"
// teglarini topadi. Redirectlarni (response.url) va nisbiy href'larni to'g'ri hisobga oladi.
// Tarmoq/parsing xatolarida hech qachon exception tashlamaydi - bo'sh natija qaytaradi.
async function discoverDeclaredFaviconUrls(pageUrl) {
  let response;
  try {
    response = await fetchWithTimeout(pageUrl, FAVICON_FETCH_TIMEOUT_MS);
  } catch (error) {
    return { candidates: [], resolvedOrigin: '' };
  }

  if (!response.ok) {
    return { candidates: [], resolvedOrigin: '' };
  }

  let html = '';
  try {
    html = await response.text();
  } catch (error) {
    return { candidates: [], resolvedOrigin: '' };
  }

  // response.url - barcha redirectlardan keyingi yakuniy manzil.
  const finalUrl = response.url || pageUrl;
  let resolvedOrigin = '';
  try {
    resolvedOrigin = new URL(finalUrl).origin;
  } catch (error) {
    resolvedOrigin = '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const linkElements = doc.querySelectorAll('link[rel][href]');

  const found = [];
  linkElements.forEach(function(link) {
    const relRank = getIconRelRank(link.getAttribute('rel'));
    if (relRank === -1) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    try {
      found.push({
        href: new URL(href, finalUrl).href,
        relRank: relRank,
        typeScore: getIconTypeScore(link),
        sizeScore: getIconSizeScore(link)
      });
    } catch (error) {
      // Yaroqsiz href - o'tkazib yuboriladi.
    }
  });

  found.sort(function(a, b) {
    if (a.relRank !== b.relRank) {
      return a.relRank - b.relRank;
    }
    if (a.typeScore !== b.typeScore) {
      return b.typeScore - a.typeScore;
    }
    return b.sizeScore - a.sizeScore;
  });

  return {
    candidates: found.map(function(item) { return item.href; }),
    resolvedOrigin: resolvedOrigin
  };
}

// Saytning o'z e'lon qilingan ikonalarini standart manbalar bilan birlashtiradi.
// Aniqlik uchun avval HTML'da topilganlar, keyin /favicon.ico (redirectdan keyingi
// origin bo'yicha), so'ngra uchinchi tomon xizmatlari sinab ko'riladi.
async function getAccurateFaviconCandidates(url) {
  const declared = await discoverDeclaredFaviconUrls(url);
  const redirectedRootFavicon = declared.resolvedOrigin
    ? [`${declared.resolvedOrigin}/favicon.ico`]
    : [];

  const combined = declared.candidates.concat(redirectedRootFavicon, getFaviconCandidates(url));

  // Dublikatlarni tartibni buzmasdan olib tashlaydi.
  return combined.filter(function(candidate, index) {
    return combined.indexOf(candidate) === index;
  });
}

function getFaviconCacheKey(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (error) {
    return '';
  }
}

export function getCachedFaviconByUrl(url, callback) {
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

// Render paytida keraksiz qayta so'rovlarni kamaytirish uchun keshni bir martada o'qib, shortcutlarga qo'llaydi.
// Mahalliy kesh har doim ustuvor: u haqiqiy tasvir baytlarini (data: URL) saqlaydi va
// tarmoqqa murojaatsiz darhol ko'rsatiladi. shortcut.icon faqat kesh hali bo'sh bo'lganda
// (masalan, birinchi ochilishda yoki eski format uchun) zaxira sifatida ishlatiladi.
export function applyCachedIconsToShortcuts(shortcuts, callback) {
  chrome.storage.local.get(FAVICON_CACHE_KEY, function(data) {
    const cacheSnapshot = data[FAVICON_CACHE_KEY] || {};

    const mergedShortcuts = shortcuts.map(function(shortcut) {
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

export function cacheFaviconByUrl(url, src, callback) {
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

function blobToDataUrl(blob) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function() {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// data: URL'ni haqiqatan ham dekodlanadigan tasvir ekanligini mahalliy tarzda tekshiradi
// (tarmoqqa murojaatsiz - buzuq/bo'sh baytlar keshga tushib qolmasligi uchun).
function verifyImageDataUrl(dataUrl) {
  return new Promise(function(resolve) {
    const img = new Image();
    img.onload = function() {
      resolve(true);
    };
    img.onerror = function() {
      resolve(false);
    };
    img.src = dataUrl;
  });
}

// Favicon baytlarini yuklab, data: URL'ga aylantiradi. Shu tarzda saqlangan ikonka
// keyingi safar tarmoqqa umuman murojaat qilmasdan, to'g'ridan-to'g'ri ko'rsatiladi.
async function fetchFaviconAsDataUrl(candidateUrl) {
  const response = await fetchWithTimeout(candidateUrl, FAVICON_FETCH_TIMEOUT_MS);
  if (!response.ok) {
    return '';
  }

  const blob = await response.blob();
  if (!blob || !blob.size) {
    return '';
  }

  const dataUrl = await blobToDataUrl(blob);
  const isValidImage = await verifyImageDataUrl(dataUrl);
  return isValidImage ? dataUrl : '';
}

async function loadFirstAvailableFaviconAsDataUrl(candidates) {
  for (const candidateUrl of candidates) {
    try {
      const dataUrl = await fetchFaviconAsDataUrl(candidateUrl);
      if (dataUrl) {
        return dataUrl;
      }
    } catch (error) {
      // Keyingi nomzodga o'tiladi.
    }
  }

  return '';
}

async function resolveFaviconDataUrl(url, title) {
  const candidates = await getAccurateFaviconCandidates(url);
  const dataUrl = await loadFirstAvailableFaviconAsDataUrl(candidates);
  const finalSrc = dataUrl || getDefaultIconForUrl(url, title);

  await new Promise(function(resolve) {
    cacheFaviconByUrl(url, finalSrc, resolve);
  });

  return finalSrc;
}

// Bir xil hostname uchun bir vaqtning o'zida boshlangan so'rovlarni bitta tarmoq
// so'roviga birlashtiradi - takroriy so'rovlarning oldini oladi.
const inFlightFaviconResolutions = new Map();

// Shortcut yaratish/yangilashdan oldin, yoki grid'da hali keshlanmagan ikonka uchun,
// faviconni aniqlab, mahalliy keshga (haqiqiy tasvir baytlari sifatida) saqlaydi.
// Avval keshni tekshiradi (tarmoq so'rovisiz), so'ngra saytning o'z <link rel="icon">
// e'lonlarini, so'ngra standart manbalarni sinab ko'radi. Har bir nomzod haqiqatan ham
// dekodlanadigan tasvir ekanligi tekshirilgandan keyingina keshga yoziladi.
export async function prefetchAndCacheFavicon(url, title, callback) {
  const cachedSrc = await new Promise(function(resolve) {
    getCachedFaviconByUrl(url, resolve);
  });

  if (cachedSrc) {
    callback(cachedSrc);
    return;
  }

  const dedupeKey = getFaviconCacheKey(url);

  if (dedupeKey && inFlightFaviconResolutions.has(dedupeKey)) {
    const dataUrl = await inFlightFaviconResolutions.get(dedupeKey);
    callback(dataUrl);
    return;
  }

  const resolutionPromise = resolveFaviconDataUrl(url, title);

  if (dedupeKey) {
    inFlightFaviconResolutions.set(dedupeKey, resolutionPromise);
  }

  try {
    const dataUrl = await resolutionPromise;
    callback(dataUrl);
  } finally {
    if (dedupeKey) {
      inFlightFaviconResolutions.delete(dedupeKey);
    }
  }
}
