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
    
    if (compressionType === 'lossy') {
      if (originalFormat === 'png') {
        // Ultra-aggressive PNG compression
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1200), // Smaller resize
            height: Math.min(metadata.height, 1200),
            fit: 'inside',
            withoutEnlargement: true
          })
          .png({ 
            compressionLevel: 9, // Maximum compression
            adaptiveFiltering: true,
            quality: Math.max(quality - 40, 10), // Ultra-aggressive quality
            palette: !hasTransparency, // Use palette when possible
            colors: hasTransparency ? Math.max(16, quality) : Math.max(8, quality / 2), // Drastically reduce colors
            dither: 1.0 // Add dithering for better quality at low colors
          })
          .toBuffer()
        outputFormat = 'png'
        
      } else {
        // Ultra-aggressive JPEG compression
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1200),
            height: Math.min(metadata.height, 1200),
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ 
            quality: Math.max(quality - 40, 10), // Ultra-aggressive
            progressive: true,
            optimizeScans: true,
            optimizeCoding: true,
            mozjpeg: true,
            trellisQuantisation: true,
            overshootDeringing: true,
            quantisationTable: 1, // Most aggressive quantization
            chromaSubsampling: '4:2:0', // Maximum chroma subsampling
            force: true
          })
          .toBuffer()
        outputFormat = 'jpeg'
      }
      
    } else if (compressionType === 'lossless') {
      if (originalFormat === 'png') {
        // Maximum lossless PNG compression
        compressedBuffer = await sharpInstance
          .png({ 
            compressionLevel: 9,
            adaptiveFiltering: true,
            quality: 100,
            palette: !hasTransparency,
            colors: hasTransparency ? 256 : 128,
            effort: 10 // Maximum effort
          })
          .toBuffer()
        outputFormat = 'png'
      } else {
        // Lossless JPEG (minimal loss)
        compressedBuffer = await sharpInstance
          .jpeg({ 
            quality: 75, // Still some compression in "lossless"
            progressive: true,
            optimizeScans: true,
            optimizeCoding: true,
            mozjpeg: true,
            trellisQuantisation: true
          })
          .toBuffer()
        outputFormat = 'jpeg'
      }
      
    } else { // custom - Maximum smart compression
      if (originalFormat === 'png') {
        if (hasTransparency) {
          // Transparent PNG - maximum compression while preserving transparency
          compressedBuffer = await sharpInstance
            .resize({ 
              width: Math.min(metadata.width, 1400),
              height: Math.min(metadata.height, 1400),
              fit: 'inside',
              withoutEnlargement: true
            })
            .png({ 
              compressionLevel: 9,
              adaptiveFiltering: true,
              quality: Math.max(quality - 20, 20),
              palette: false,
              colors: Math.max(32, quality),
              dither: 0.5
            })
            .toBuffer()
        } else {
          // Non-transparent PNG - extreme compression
          compressedBuffer = await sharpInstance
            .resize({ 
              width: Math.min(metadata.width, 1400),
              height: Math.min(metadata.height, 1400),
              fit: 'inside',
              withoutEnlargement: true
            })
            .png({ 
              compressionLevel: 9,
              adaptiveFiltering: true,
              quality: Math.max(quality - 25, 15),
              palette: true,
              colors: Math.max(16, quality / 2),
              dither: 1.0
            })
            .toBuffer()
        }
        outputFormat = 'png'
      } else {
        // Smart JPEG compression
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1400),
            height: Math.min(metadata.height, 1400),
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ 
            quality: Math.max(quality - 20, 20),
            progressive: true,
            optimizeScans: true,
            mozjpeg: true,
            trellisQuantisation: true,
            overshootDeringing: true,
            quantisationTable: 2,
            chromaSubsampling: '4:2:0'
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
