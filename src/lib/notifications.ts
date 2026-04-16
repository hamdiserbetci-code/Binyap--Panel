/**
 * ETM Binyapı ERP — Web Push Bildirim Yöneticisi
 */

// Service Worker kaydet
export async function swKaydet(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch (e) {
    console.warn('SW kayıt hatası:', e)
    return null
  }
}

// Bildirim izni iste
export async function bildirimIzniIste(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

// Anlık (local) bildirim gönder — push server gerekmez
export function localBildirim(title: string, body: string, url = '/') {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url },
      vibrate: [200, 100, 200],
      tag: `etm-${Date.now()}`,
    } as any)
  }).catch(() => {
    // Fallback: normal Notification API
    new Notification(title, { body, icon: '/icon-192.png' })
  })
}

// Gecikmiş ödeme bildirimi
export function odemeBildirimi(adet: number) {
  if (adet <= 0) return
  localBildirim(
    '⚠️ Gecikmiş Ödeme',
    `${adet} adet ödemenin vadesi geçmiş. Kontrol edin.`,
    '/?module=odeme-plani'
  )
}

// Poliçe bitiş bildirimi
export function policeBildirimi(adet: number) {
  if (adet <= 0) return
  localBildirim(
    '🛡️ Poliçe Yenileme',
    `${adet} poliçenin süresi 30 gün içinde doluyor.`,
    '/?module=police'
  )
}

// Görev hatırlatma bildirimi
export function gorevBildirimi(baslik: string) {
  localBildirim(
    '📋 Görev Hatırlatıcı',
    baslik,
    '/?module=gorevler'
  )
}

// İzin durumu
export function bildirimIzniVar(): boolean {
  return 'Notification' in window && Notification.permission === 'granted'
}
