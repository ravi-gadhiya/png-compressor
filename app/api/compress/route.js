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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported' }, { status: 400 })
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const sharpInstance = sharp(buffer)
    const metadata = await sharpInstance.metadata()
    
    let compressedBuffer

    // Strategy: Always use WebP compression internally, then convert to PNG
    // This gives superior compression while maintaining PNG compatibility
    
    try {
      // Step 1: Compress as WebP (best compression algorithms)
      const webpBuffer = await sharpInstance
        .webp({ 
          quality: quality,
          effort: 6,
          smartSubsample: true,
          reductionEffort: 6,
          alphaQuality: metadata.channels === 4 ? quality : undefined // Handle transparency
        })
        .toBuffer()
      
      // Step 2: Convert WebP back to PNG (maintains compression benefits)
      compressedBuffer = await sharp(webpBuffer)
        .png({ 
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: false, // Preserve quality and transparency
          force: true
        })
        .toBuffer()
        
    } catch (error) {
      // Fallback: Direct PNG compression if WebP conversion fails
      console.warn('WebP conversion failed, using direct PNG compression:', error.message)
      compressedBuffer = await sharpInstance
        .png({ 
          quality: quality,
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: false
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
        'Content-Disposition': `attachment; filename="compressed_${file.name.split('.')[0]}.png"`
      }
    })

  } catch (error) {
    console.error('Compression error:', error)
    return NextResponse.json({ 
      error: 'Compression failed: ' + error.message 
    }, { status: 500 })
  }
}
