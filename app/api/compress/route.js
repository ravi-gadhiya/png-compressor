import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const quality = parseInt(formData.get('quality')) || 80
    const compressionType = formData.get('compressionType') || 'lossy'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const sharpInstance = sharp(buffer)
    const metadata = await sharpInstance.metadata()
    
    let compressedBuffer
    let outputFormat = 'jpeg'
    
    if (compressionType === 'lossy') {
      // Aggressive compression like Compressor.io (60-95% reduction)
      compressedBuffer = await sharpInstance
        .resize({ 
          width: Math.min(metadata.width, 1920),
          height: Math.min(metadata.height, 1920),
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ 
          quality: Math.max(quality - 15, 10), // More aggressive compression
          progressive: true,
          optimizeScans: true,
          optimizeCoding: true,
          mozjpeg: true,
          trellisQuantisation: true,
          overshootDeringing: true,
          quantisationTable: 3 // Aggressive quantization
        })
        .toBuffer()
      outputFormat = 'jpeg'
      
    } else if (compressionType === 'lossless') {
      // Lossless compression (5-20% reduction like Compressor.io)
      if (metadata.format === 'png') {
        compressedBuffer = await sharpInstance
          .png({ 
            compressionLevel: 9,
            adaptiveFiltering: true,
            palette: true,
            quality: 100
          })
          .toBuffer()
        outputFormat = 'png'
      } else {
        compressedBuffer = await sharpInstance
          .jpeg({ 
            quality: 95,
            progressive: true,
            optimizeScans: true,
            optimizeCoding: true
          })
          .toBuffer()
        outputFormat = 'jpeg'
      }
      
    } else { // custom
      // Smart format detection and optimization
      if (metadata.format === 'png' && metadata.channels === 4) {
        // PNG with transparency - keep as WebP for best compression
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
            alphaQuality: quality,
            smartSubsample: true
          })
          .toBuffer()
        outputFormat = 'webp'
      } else {
        // Convert to JPEG for maximum compression
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
    }
    
    const originalSize = buffer.length
    const compressedSize = compressedBuffer.length
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
    const sizeSavedKB = ((originalSize - compressedSize) / 1024).toFixed(0)
    
    return new NextResponse(compressedBuffer, {
      status: 200,
      headers: {
        'Content-Type': `image/${outputFormat}`,
        'Content-Length': compressedSize.toString(),
        'X-Original-Size': originalSize.toString(),
        'X-Compressed-Size': compressedSize.toString(),
        'X-Compression-Ratio': compressionRatio,
        'X-Size-Saved-KB': sizeSavedKB,
        'X-Output-Format': outputFormat,
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
