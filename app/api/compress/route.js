import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const quality = parseInt(formData.get('quality')) || 80
    const format = formData.get('format') || 'auto'
    const compressionType = formData.get('compressionType') || 'lossy'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let compressedBuffer
    let outputFormat = format
    
    const sharpInstance = sharp(buffer)
    const metadata = await sharpInstance.metadata()
    
    if (format === 'auto') {
      outputFormat = metadata.format === 'png' ? 'png' : 'jpeg'
    }

    // Enhanced compression algorithms like Compressor.io
    switch (outputFormat) {
      case 'jpeg':
      case 'jpg':
        if (compressionType === 'lossless') {
          compressedBuffer = await sharpInstance
            .jpeg({ 
              quality: 95,
              progressive: true,
              optimizeScans: true,
              optimizeCoding: true,
              mozjpeg: true
            })
            .toBuffer()
        } else {
          // Aggressive lossy compression like Compressor.io
          compressedBuffer = await sharpInstance
            .resize({ 
              width: Math.min(metadata.width, 1920),
              height: Math.min(metadata.height, 1920),
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({ 
              quality: Math.max(quality - 10, 20), // More aggressive
              progressive: true,
              optimizeScans: true,
              optimizeCoding: true,
              mozjpeg: true,
              trellisQuantisation: true,
              overshootDeringing: true
            })
            .toBuffer()
        }
        break

      case 'png':
        if (compressionType === 'lossless') {
          compressedBuffer = await sharpInstance
            .png({ 
              compressionLevel: 9,
              adaptiveFiltering: true,
              palette: true
            })
            .toBuffer()
        } else {
          // Convert PNG to JPEG for better compression (like Compressor.io does)
          compressedBuffer = await sharpInstance
            .resize({ 
              width: Math.min(metadata.width, 1920),
              height: Math.min(metadata.height, 1920),
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({ 
              quality: quality,
              progressive: true,
              optimizeScans: true,
              mozjpeg: true
            })
            .toBuffer()
          outputFormat = 'jpeg'
        }
        break

      case 'webp':
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1920),
            height: Math.min(metadata.height, 1920),
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ 
            quality: quality,
            effort: 6,
            smartSubsample: true,
            reductionEffort: 6
          })
          .toBuffer()
        break

      default:
        compressedBuffer = await sharpInstance
          .jpeg({ quality: quality })
          .toBuffer()
        outputFormat = 'jpeg'
    }

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
    return NextResponse.json({ 
      error: 'Compression failed: ' + error.message 
    }, { status: 500 })
  }
}
