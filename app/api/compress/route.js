import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import JSZip from 'jszip'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const quality = parseInt(formData.get('quality')) || 80
    const format = formData.get('format') || 'auto'
    const fileCount = parseInt(formData.get('fileCount')) || 0
    
    if (fileCount === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Validate file count limit
    if (fileCount > 50) {
      return NextResponse.json({ error: 'Maximum 50 files allowed' }, { status: 400 })
    }

    const zip = new JSZip()
    let totalOriginalSize = 0
    let totalCompressedSize = 0
    const processedFiles = []

    // Process each file
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file_${i}`)
      
      if (!file) continue

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        continue // Skip files larger than 10MB
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      let compressedBuffer
      let outputFormat = format

      // Use Sharp for compression
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
              optimizeScans: true,
              mozjpeg: true
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
              effort: 6,
              smartSubsample: true
            })
            .toBuffer()
          break

        default:
          compressedBuffer = await sharpInstance
            .jpeg({ quality: quality })
            .toBuffer()
          outputFormat = 'jpeg'
      }

      // Add compressed file to ZIP
      const originalName = file.name.split('.')[0]
      const compressedFileName = `compressed_${originalName}.${outputFormat}`
      
      zip.file(compressedFileName, compressedBuffer)

      // Track sizes
      totalOriginalSize += buffer.length
      totalCompressedSize += compressedBuffer.length

      processedFiles.push({
        originalName: file.name,
        compressedName: compressedFileName,
        originalSize: buffer.length,
        compressedSize: compressedBuffer.length
      })
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    
    const compressionRatio = ((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(1)

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': zipBuffer.length.toString(),
        'X-Original-Size': totalOriginalSize.toString(),
        'X-Compressed-Size': totalCompressedSize.toString(),
        'X-Compression-Ratio': compressionRatio,
        'X-Files-Processed': processedFiles.length.toString(),
        'Content-Disposition': `attachment; filename="compressed_images_${processedFiles.length}files.zip"`
      }
    })

  } catch (error) {
    console.error('Compression error:', error)
    return NextResponse.json({
      error: 'Compression failed: ' + error.message
    }, { status: 500 })
  }
}
