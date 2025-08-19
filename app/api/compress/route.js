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
    
    const hasTransparency = metadata.channels === 4 || metadata.hasAlpha
    const isOriginallyPNG = metadata.format === 'png'
    
    let compressedBuffer
    let outputFormat = metadata.format
    
    if (compressionType === 'lossy') {
      if (isOriginallyPNG && hasTransparency) {
        // For transparent PNGs: Use aggressive WebP compression (better than PNG)
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1600), // More aggressive resize
            height: Math.min(metadata.height, 1600),
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ 
            quality: Math.max(quality - 20, 20), // Much more aggressive
            effort: 6,
            alphaQuality: Math.max(quality - 10, 50),
            smartSubsample: true,
            reductionEffort: 6
          })
          .toBuffer()
        outputFormat = 'webp'
        
      } else {
        // For non-transparent images: Ultra-aggressive JPEG compression
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1600), // Smaller max size
            height: Math.min(metadata.height, 1600),
            fit: 'inside',
            withoutEnlargement: true
          })
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ 
            quality: Math.max(quality - 30, 15), // Ultra-aggressive quality reduction
            progressive: true,
            optimizeScans: true,
            optimizeCoding: true,
            mozjpeg: true,
            trellisQuantisation: true,
            overshootDeringing: true,
            quantisationTable: 2, // More aggressive quantization
            chromaSubsampling: '4:2:0' // Aggressive chroma subsampling
          })
          .toBuffer()
        outputFormat = 'jpeg'
      }
      
    } else if (compressionType === 'lossless') {
      if (isOriginallyPNG) {
        // Enhanced lossless PNG compression
        compressedBuffer = await sharpInstance
          .png({ 
            compressionLevel: 9,
            adaptiveFiltering: true,
            quality: 100,
            palette: hasTransparency ? false : true,
            colors: hasTransparency ? 256 : 128 // Reduce color palette
          })
          .toBuffer()
        outputFormat = 'png'
      } else {
        // Lossless JPEG (minimal compression)
        compressedBuffer = await sharpInstance
          .jpeg({ 
            quality: 85, // Lower than default for some compression
            progressive: true,
            optimizeScans: true,
            optimizeCoding: true,
            mozjpeg: true
          })
          .toBuffer()
        outputFormat = 'jpeg'
      }
      
    } else { // custom - Smart optimization like Compressor.io
      if (isOriginallyPNG && hasTransparency) {
        // Smart WebP conversion for transparent images
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1800),
            height: Math.min(metadata.height, 1800),
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ 
            quality: quality,
            effort: 6,
            alphaQuality: quality,
            smartSubsample: true,
            reductionEffort: 6
          })
          .toBuffer()
        outputFormat = 'webp'
        
      } else if (isOriginallyPNG && !hasTransparency) {
        // Convert PNG to JPEG for massive savings (Compressor.io strategy)
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1800),
            height: Math.min(metadata.height, 1800),
            fit: 'inside',
            withoutEnlargement: true
          })
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ 
            quality: quality,
            progressive: true,
            optimizeScans: true,
            mozjpeg: true,
            trellisQuantisation: true,
            overshootDeringing: true
          })
          .toBuffer()
        outputFormat = 'jpeg'
        
      } else {
        // Standard JPEG optimization
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1800),
            height: Math.min(metadata.height, 1800),
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ 
            quality: quality,
            progressive: true,
            optimizeScans: true,
            mozjpeg: true,
            trellisQuantisation: true,
            overshootDeringing: true
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
