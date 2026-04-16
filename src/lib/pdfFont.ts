import type jsPDF from 'jspdf'

// Roboto TTF'yi fetch edip jsPDF'e kaydet
export async function registerRobotoFont(doc: jsPDF) {
  try {
    // Regular
    const regRes  = await fetch('/fonts/Roboto-Regular.ttf')
    const regBuf  = await regRes.arrayBuffer()
    const regB64  = arrayBufferToBase64(regBuf)
    doc.addFileToVFS('Roboto-Regular.ttf', regB64)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')

    // Bold
    const boldRes = await fetch('/fonts/Roboto-Bold.ttf')
    const boldBuf = await boldRes.arrayBuffer()
    const boldB64 = arrayBufferToBase64(boldBuf)
    doc.addFileToVFS('Roboto-Bold.ttf', boldB64)
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')

    doc.setFont('Roboto', 'normal')
  } catch (e) {
    console.warn('Font yüklenemedi, varsayılan kullanılıyor:', e)
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes  = new Uint8Array(buffer)
  let binary   = ''
  const chunk  = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk)
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j])
    }
  }
  return btoa(binary)
}
