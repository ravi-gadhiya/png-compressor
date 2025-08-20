import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const quality = parseInt(formData.get('quality')) || 80
    const format = formData.get('format') || 'auto'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    let compressedBuffer
    let outputFormat = format
    
    // Use Sharp only (works reliably on Vercel)
    const sharpInstance = sharp(buffer)
    const metadata = await sharpInstance.metadata()
    
    if (format === 'auto') {
      outputFormat = metadata.format === 'png' ? 'png' : 'jpeg'
    }

    switch (outputFormat) {
      case 'jpeg':
      case 'jpg':
        compressedBuffer = await sharpInstance
          .jpeg({ 
            quality: quality,
            progressive: true,
            optimizeScans: true
          })
          .toBuffer()
        break

      case 'png':
        compressedBuffer = await sharpInstance
          .png({ 
            quality: quality,
            compressionLevel: 9,
            adaptiveFiltering: true
          })
          .toBuffer()
        break

      case 'webp':
        compressedBuffer = await sharpInstance
          .webp({ 
            quality: quality,
            effort: 6
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
