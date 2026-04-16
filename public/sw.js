// ETM Binyapı ERP — Service Worker
const CACHE = 'etm-erp-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Push bildirimi al
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  const title   = data.title   || 'ETM Binyapı ERP'
  const body    = data.body    || 'Yeni bildirim'
  const icon    = data.icon    || '/icon-192.png'
  const badge   = data.badge   || '/icon-192.png'
  const url     = data.url     || '/'
  const tag     = data.tag     || 'etm-notification'

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  )
})

// Bildirime tıklanınca uygulamayı aç
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})
