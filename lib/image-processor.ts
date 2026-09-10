/**
 * Image optimization for server actions.
 * - Node.js (dev): uses sharp (bundled with Next.js)
 * - Cloudflare Workers (prod): uses photon WASM via workerd entry point
 */

const MAX_WIDTH = 1200

export interface OptimizedImage {
  buffer: Uint8Array
  width: number
  height: number
}

let sharpModule: { default: any } | null | undefined = undefined

async function getSharp() {
  if (sharpModule === undefined) {
    try {
      const moduleName = 'sharp'
      sharpModule = await import(/* webpackIgnore: true */ moduleName)
    } catch {
      sharpModule = null
    }
  }
  return sharpModule
}

export async function optimizeImage(fileBuffer: Uint8Array): Promise<OptimizedImage> {
  const sharpPkg = await getSharp()

  if (sharpPkg) {
    const sharp = sharpPkg.default
    const instance = sharp(fileBuffer)
    const metadata = await instance.metadata()
    const originalWidth = metadata.width ?? 0

    let processed = instance
    if (originalWidth > MAX_WIDTH) {
      processed = instance.resize({ width: MAX_WIDTH, withoutEnlargement: true })
    }

    const result = await processed.webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
    return {
      buffer: new Uint8Array(result.data),
      width: result.info.width,
      height: result.info.height,
    }
  }

  return optimizeWithPhoton(fileBuffer)
}

let photonModule: Promise<{
  PhotonImage: typeof import("@cf-wasm/photon/workerd").PhotonImage
  SamplingFilter: typeof import("@cf-wasm/photon/workerd").SamplingFilter
  resize: typeof import("@cf-wasm/photon/workerd").resize
}> | null = null

async function getPhoton() {
  if (!photonModule) {
    photonModule = import("@cf-wasm/photon/workerd")
  }
  return photonModule
}

async function optimizeWithPhoton(fileBuffer: Uint8Array): Promise<OptimizedImage> {
  const { PhotonImage, SamplingFilter, resize } = await getPhoton()

  // new_from_byteslice copies bytes directly into WASM linear memory.
  // new_from_blob relies on js_sys::Blob which calls Blob.arrayBuffer()
  // via FFI — Cloudflare Workers Blob doesn't implement the full browser
  // API that js_sys expects, causing a WASM panic ("unreachable").
  const inputImage = PhotonImage.new_from_byteslice(fileBuffer)

  let outputImage: InstanceType<typeof PhotonImage> | null = null
  const originalWidth = inputImage.get_width()
  const originalHeight = inputImage.get_height()

  if (originalWidth > MAX_WIDTH) {
    const aspectRatio = originalHeight / originalWidth
    const newWidth = MAX_WIDTH
    const newHeight = Math.round(MAX_WIDTH * aspectRatio)
    outputImage = resize(inputImage, newWidth, newHeight, SamplingFilter.Lanczos3)
  }

  const target = outputImage ?? inputImage
  const webpBytes = target.get_bytes_webp()
  const width = target.get_width()
  const height = target.get_height()

  inputImage.free()
  if (outputImage) {
    outputImage.free()
  }

  return { buffer: webpBytes, width, height }
}
