import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const quality = parseInt(formData.get('quality')) || 100

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Always convert to WebP (best compression)
    const sharpInstance = sharp(buffer)
    const metadata = await sharpInstance.metadata()

    const compressedBuffer = await sharpInstance
      .webp({
        quality: quality,
        effort: 6,
        smartSubsample: true,
        reductionEffort: 6
      })
      .toBuffer()

    const originalSize = buffer.length
    const compressedSize = compressedBuffer.length
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)

    return new NextResponse(compressedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': compressedSize.toString(),
        'X-Original-Size': originalSize.toString(),
        'X-Compressed-Size': compressedSize.toString(),
        'X-Compression-Ratio': compressionRatio,
        'Content-Disposition': `attachment; filename="compressed_${file.name.split('.')[0]}.webp"`
      }
    })

  } catch (error) {
    console.error('Compression error:', error)
    return NextResponse.json({
      error: 'Compression failed: ' + error.message
    }, { status: 500 })
  }
}
