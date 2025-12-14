export async function compressImage(file, { maxSize = 640, quality = 0.8, mimeType = 'image/jpeg' } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        const largestSide = Math.max(image.width, image.height)
        const scale = largestSide > maxSize ? maxSize / largestSide : 1
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Unable to compress image'))
              return
            }
            resolve(blob)
          },
          mimeType,
          quality
        )
      }
      image.onerror = () => reject(new Error('Invalid image file'))
      image.src = reader.result
    }
    reader.onerror = () => reject(new Error('Unable to read image file'))
    reader.readAsDataURL(file)
  })
}
