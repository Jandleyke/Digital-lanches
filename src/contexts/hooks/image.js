/**
 * Redimensiona e comprime uma imagem para reduzir o tamanho do armazenamento no Firestore.
 */
export async function processarFotoPerfil(file, maxSize = 900, maxByteSize = 750000) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      let quality = 0.85
      let dataUrl = canvas.toDataURL('image/jpeg', quality)
      while (dataUrl.length > maxByteSize && quality > 0.1) {
        quality = Math.round((quality - 0.1) * 10) / 10
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }
      URL.revokeObjectURL(url)
      resolve(dataUrl)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Formato de imagem não suportado.')) }
    img.src = url
  })
}