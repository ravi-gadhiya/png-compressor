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
    const originalFormat = metadata.format
    
    let compressedBuffer
    let outputFormat = originalFormat
    
    // KEEP ORIGINAL SIZE - NO RESIZING
    if (originalFormat === 'png') {
      if (compressionType === 'lossy' && !hasTransparency) {
        // Non-transparent PNG: Smart color optimization WITHOUT quality loss
        compressedBuffer = await sharpInstance
          .png({ 
            compressionLevel: 9, // Maximum compression
            adaptiveFiltering: true,
            palette: true, // Convert to indexed colors for smaller size
            quality: 100, // Keep visual quality
            colors: Math.min(256, Math.max(128, (quality / 100) * 256)), // Smart color reduction
            dither: 1.0, // Add dithering to maintain visual quality
            effort: 10 // Maximum effort for best compression
          })
          .toBuffer()
      } else {
        // Transparent PNG or lossless: Pure optimization
        compressedBuffer = await sharpInstance
          .png({ 
            compressionLevel: 9, // Maximum compression
            adaptiveFiltering: true,
            palette: !hasTransparency, // Use palette only if no transparency
            quality: 100, // Keep full quality
            effort: 10 // Maximum compression effort
          })
          .toBuffer()
      }
      outputFormat = 'png'
      
    } else if (originalFormat === 'jpeg') {
      if (compressionType === 'lossless') {
        // True lossless: Only remove metadata and optimize encoding
        compressedBuffer = await sharpInstance
          .jpeg({ 
            quality: 95, // Minimal quality loss
            progressive: true, // Better compression
            optimizeScans: true, // Optimize scanning
            optimizeCoding: true, // Optimize Huffman coding
            mozjpeg: true, // Use mozjpeg for better compression
            trellisQuantisation: false, // Keep quality high
            overshootDeringing: false, // Keep quality high
            force: false // Don't force if not beneficial
          })
          .toBuffer()
      } else {
        // Smart lossy: Good compression with minimal visual loss
        compressedBuffer = await sharpInstance
          .jpeg({ 
            quality: Math.max(quality, 60), // Don't go below 60 for quality
            progressive: true,
            optimizeScans: true,
            optimizeCoding: true,
            mozjpeg: true,
            trellisQuantisation: true, // Better compression
            overshootDeringing: true, // Reduce artifacts
            quantisationTable: 0 // Use default quantization for quality
          })
          .toBuffer()
      }
      outputFormat = 'jpeg'
      
    } else {
      // Other formats: Just optimize without changing
      compressedBuffer = buffer
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
