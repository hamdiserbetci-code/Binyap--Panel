/* ── ETM Panel Service Worker ── push bildirimleri ── */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

/* ── Push (sunucu kaynaklı) ─────────────────────────────────────────────── */
self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title || 'Görev Hatırlatıcısı', {
      body:    data.body  || '',
      icon:    data.icon  || '/favicon.ico',
      badge:   '/favicon.ico',
      tag:     data.tag   || 'gunluk-is',
      data:    { url: data.url || '/', isId: data.isId },
      actions: [
        { action: 'done',   title: '✓ Tamamlandı' },
        { action: 'snooze', title: '⏰ 1 saat ertele' },
      ],
      requireInteraction: true,
      vibrate: [200, 100, 200],
    })
  )
})

/* ── showNotification (uygulama içi tetikli) aynı handler'ı kullanır ─────── */

/* ── Notification tıklama ───────────────────────────────────────────────── */
self.addEventListener('notificationclick', e => {
  const notif  = e.notification
  const isId   = notif.data && notif.data.isId
  const action = e.action

  notif.close()

  if (action === 'done' && isId) {
    /* Aktif sekmeye mesaj gönder → uygulamada tamamlansın */
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        for (const c of clients) {
          c.postMessage({ type: 'TASK_DONE', isId })
        }
        /* Sekme yoksa aç */
        if (!clients.length) return self.clients.openWindow('/')
      })
    )
    return
  }

  if (action === 'snooze' && isId) {
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        for (const c of clients) {
          c.postMessage({ type: 'TASK_SNOOZE', isId, mins: 60 })
        }
        if (!clients.length) return self.clients.openWindow('/')
      })
    )
    return
  }

  /* Varsayılan: uygulamayı aç / öne getir */
  const url = (notif.data && notif.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin)) { c.focus(); return }
      }
      return self.clients.openWindow(url)
    })
  )
})
