export const FAVICON_CACHE_KEY = 'faviconCache';
export const FAVICON_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 kun
export const FAVICON_FETCH_TIMEOUT_MS = 4000; // Sahifa HTML'i va favicon baytlarini yuklash uchun maksimal kutish vaqti

export const DEFAULT_SHORTCUTS = [
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
