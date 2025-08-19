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
    
    // Check if image has transparency
    const hasTransparency = metadata.channels === 4 || metadata.hasAlpha
    const isOriginallyPNG = metadata.format === 'png'
    
    let compressedBuffer
    let outputFormat = metadata.format // Keep original format by default
    
    if (compressionType === 'lossy') {
      if (isOriginallyPNG && hasTransparency) {
        // For transparent PNGs, keep as PNG to preserve transparency
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1920),
            height: Math.min(metadata.height, 1920),
            fit: 'inside',
            withoutEnlargement: true
          })
          .png({ 
            compressionLevel: 9,
            adaptiveFiltering: true,
            quality: quality,
            palette: false, // Don't convert to palette to preserve transparency
            colors: 256
          })
          .toBuffer()
        outputFormat = 'png'
        
      } else {
        // For non-transparent images, convert to JPEG for better compression
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1920),
            height: Math.min(metadata.height, 1920),
            fit: 'inside',
            withoutEnlargement: true
          })
          .flatten({ background: { r: 255, g: 255, b: 255 } }) // White background if needed
          .jpeg({ 
            quality: Math.max(quality - 15, 10),
            progressive: true,
            optimizeScans: true,
            optimizeCoding: true,
            mozjpeg: true,
            trellisQuantisation: true,
            overshootDeringing: true,
            quantisationTable: 3
          })
          .toBuffer()
        outputFormat = 'jpeg'
      }
      
    } else if (compressionType === 'lossless') {
      if (isOriginallyPNG) {
        // Lossless PNG compression while preserving transparency
        compressedBuffer = await sharpInstance
          .png({ 
            compressionLevel: 9,
            adaptiveFiltering: true,
            quality: 100,
            palette: hasTransparency ? false : true // Preserve alpha channel
          })
          .toBuffer()
        outputFormat = 'png'
      } else {
        // Lossless JPEG
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
      if (isOriginallyPNG && hasTransparency) {
        // For transparent PNGs, use WebP to maintain transparency with better compression
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
            alphaQuality: quality, // Preserve alpha channel quality
            smartSubsample: true
          })
          .toBuffer()
        outputFormat = 'webp'
      } else {
        // For non-transparent images, use JPEG
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1920),
            height: Math.min(metadata.height, 1920),
            fit: 'inside',
            withoutEnlargement: true
          })
          .flatten({ background: { r: 255, g: 255, b: 255 } })
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
        'Content-Disposition': `attachment; filename="compressed_${file.name.split('.')[0]}.${outputFormat}"`
      }
    })

  } catch (error) {
    console.error('Compression error:', error)
    return NextResponse.json({ 
      error: 'Compression failed: ' + error.message 
    }, { status: 500 })
  }
}
