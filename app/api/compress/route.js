import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const quality = parseInt(formData.get('quality')) || 80
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Only accept PNG files
    if (file.type !== 'image/png') {
      return NextResponse.json({ error: 'Only PNG files are supported' }, { status: 400 })
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit` 
      }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const sharpInstance = sharp(buffer)
    const metadata = await sharpInstance.metadata()
    
    let compressedBuffer
    
    // Strategy: Use WebP compression internally, then convert back to PNG
    // This gives much better compression than direct PNG compression
    
    try {
      // Step 1: Compress as WebP (superior compression algorithms)
      const webpBuffer = await sharpInstance
        .webp({ 
          quality: quality,
          effort: 6,
          smartSubsample: true,
          reductionEffort: 6
        })
        .toBuffer()
      
      // Step 2: Convert WebP back to PNG (maintains compression benefits)
      compressedBuffer = await sharp(webpBuffer)
        .png({ 
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: false // Keep full quality
        })
        .toBuffer()
    } catch (conversionError) {
      // Fallback: Direct PNG compression if WebP conversion fails
      console.warn('WebP conversion failed, using direct PNG compression:', conversionError.message)
      compressedBuffer = await sharpInstance
        .png({ 
          compressionLevel: 9,
          adaptiveFiltering: true,
          quality: quality
        })
        .toBuffer()
    }
    
    const originalSize = buffer.length
    const compressedSize = compressedBuffer.length
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)

    return new NextResponse(compressedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png', // Always output PNG
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
