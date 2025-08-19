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
    let outputFormat = originalFormat // Keep original format
    
    if (compressionType === 'lossy') {
      if (originalFormat === 'png') {
        if (hasTransparency) {
          // Transparent PNG - keep as PNG but compress aggressively
          compressedBuffer = await sharpInstance
            .resize({ 
              width: Math.min(metadata.width, 1600),
              height: Math.min(metadata.height, 1600),
              fit: 'inside',
              withoutEnlargement: true
            })
            .png({ 
              compressionLevel: 9,
              adaptiveFiltering: true,
              quality: Math.max(quality - 20, 20), // Aggressive quality reduction
              palette: false, // Keep transparency
              colors: Math.min(256, Math.max(32, quality * 3)) // Reduce colors based on quality
            })
            .toBuffer()
          outputFormat = 'png'
        } else {
          // Non-transparent PNG - compress as PNG with palette
          compressedBuffer = await sharpInstance
            .resize({ 
              width: Math.min(metadata.width, 1600),
              height: Math.min(metadata.height, 1600),
              fit: 'inside',
              withoutEnlargement: true
            })
            .png({ 
              compressionLevel: 9,
              adaptiveFiltering: true,
              quality: Math.max(quality - 15, 30),
              palette: true, // Use palette for better compression
              colors: Math.min(256, Math.max(64, quality * 2))
            })
            .toBuffer()
          outputFormat = 'png'
        }
      } else {
        // JPEG - ultra-aggressive compression
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1600),
            height: Math.min(metadata.height, 1600),
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ 
            quality: Math.max(quality - 30, 15), // Very aggressive
            progressive: true,
            optimizeScans: true,
            optimizeCoding: true,
            mozjpeg: true,
            trellisQuantisation: true,
            overshootDeringing: true,
            quantisationTable: 2,
            chromaSubsampling: '4:2:0'
          })
          .toBuffer()
        outputFormat = 'jpeg'
      }
      
    } else if (compressionType === 'lossless') {
      if (originalFormat === 'png') {
        // Lossless PNG compression
        compressedBuffer = await sharpInstance
          .png({ 
            compressionLevel: 9,
            adaptiveFiltering: true,
            quality: 100,
            palette: hasTransparency ? false : true
          })
          .toBuffer()
        outputFormat = 'png'
      } else {
        // Lossless JPEG
        compressedBuffer = await sharpInstance
          .jpeg({ 
            quality: 90,
            progressive: true,
            optimizeScans: true,
            optimizeCoding: true,
            mozjpeg: true
          })
          .toBuffer()
        outputFormat = 'jpeg'
      }
      
    } else { // custom
      if (originalFormat === 'png') {
        // Smart PNG compression based on transparency
        if (hasTransparency) {
          compressedBuffer = await sharpInstance
            .resize({ 
              width: Math.min(metadata.width, 1700),
              height: Math.min(metadata.height, 1700),
              fit: 'inside',
              withoutEnlargement: true
            })
            .png({ 
              compressionLevel: 9,
              adaptiveFiltering: true,
              quality: quality,
              palette: false,
              colors: Math.min(256, Math.max(128, quality * 2.5))
            })
            .toBuffer()
        } else {
          compressedBuffer = await sharpInstance
            .resize({ 
              width: Math.min(metadata.width, 1700),
              height: Math.min(metadata.height, 1700),
              fit: 'inside',
              withoutEnlargement: true
            })
            .png({ 
              compressionLevel: 9,
              adaptiveFiltering: true,
              quality: quality,
              palette: true,
              colors: Math.min(256, Math.max(64, quality * 2))
            })
            .toBuffer()
        }
        outputFormat = 'png'
      } else {
        // Smart JPEG compression
        compressedBuffer = await sharpInstance
          .resize({ 
            width: Math.min(metadata.width, 1700),
            height: Math.min(metadata.height, 1700),
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ 
            quality: Math.max(quality - 10, 25),
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
