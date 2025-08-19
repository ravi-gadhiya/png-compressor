import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import imagemin from 'imagemin'
import imageminMozjpeg from 'imagemin-mozjpeg'
import imageminPngquant from 'imagemin-pngquant'
import imageminWebp from 'imagemin-webp'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const quality = parseInt(formData.get('quality')) || 80
    const format = formData.get('format') || 'auto'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let compressedBuffer
    let outputFormat = format

    // Detect original format if auto
    const metadata = await sharp(buffer).metadata()
    if (format === 'auto') {
      outputFormat = metadata.format
    }

    // Compress based on format
    switch (outputFormat) {
      case 'jpeg':
      case 'jpg':
        // Use mozjpeg for superior JPEG compression
        compressedBuffer = await imagemin.buffer(buffer, {
          plugins: [
            imageminMozjpeg({
              quality: quality,
              progressive: true,
              optimize: true
            })
          ]
        })
        break

      case 'png':
        // Use pngquant for PNG compression
        compressedBuffer = await imagemin.buffer(buffer, {
          plugins: [
            imageminPngquant({
              quality: [quality / 100 - 0.1, quality / 100],
              strip: true,
              speed: 1
            })
          ]
        })
        break

      case 'webp':
        // Use Sharp for WebP (best compression)
        compressedBuffer = await sharp(buffer)
          .webp({ 
            quality: quality,
            effort: 6,
            smartSubsample: true
          })
          .toBuffer()
        break

      default:
        // Fallback: convert to JPEG
        compressedBuffer = await sharp(buffer)
          .jpeg({ 
            quality: quality,
            progressive: true,
            optimizeScans: true,
            mozjpeg: true
          })
          .toBuffer()
        outputFormat = 'jpeg'
    }

    // Calculate compression stats
    const originalSize = buffer.length
    const compressedSize = compressedBuffer.length
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)

    return new NextResponse(compressedBuffer, {
      status: 200,
      headers: {
        'Content-Type': `image/${outputFormat}`,
        'Content-Length': compressedSize.toString(),
        'X-Original-Size': originalSize.toString(),
        'X-Compressed-Size': compressedSize.toString(),
        'X-Compression-Ratio': compressionRatio,
        'Content-Disposition': `attachment; filename="compressed_${file.name}"`
      }
    })

  } catch (error) {
    console.error('Compression error:', error)
    return NextResponse.json({ error: 'Compression failed' }, { status: 500 })
  }
}
