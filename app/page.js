'use client'
import { useState, useEffect } from 'react'

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [compressedResults, setCompressedResults] = useState([])
  const [isCompressing, setIsCompressing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [quality, setQuality] = useState(100)
  const [processingProgress, setProcessingProgress] = useState(0)

  // Quality presets
  const qualityPresets = [
    { label: '20%', value: 20 },
    { label: '40%', value: 40 },
    { label: '60%', value: 60 },
    { label: '80%', value: 80 },
    { label: 'Max', value: 100 }
  ]

  const validateFiles = (files) => {
    const validFiles = []
    const errors = []
    
    // Limit to 50 files
    if (files.length > 50) {
      errors.push(`Too many files! Maximum 50 files allowed. You selected ${files.length} files.`)
      return { validFiles: [], errors }
    }
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Check file type (PNG only)
      if (file.type !== 'image/png') {
        errors.push(`${file.name}: Only PNG files are supported`)
        continue
      }
      
      // Check file size (10MB max)
      const maxSize = 10 * 1024 * 1024 // 10MB in bytes
      if (file.size > maxSize) {
        errors.push(`${file.name}: File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 10MB limit`)
        continue
      }
      
      validFiles.push(file)
    }
    
    return { validFiles, errors }
  }

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files)
    const { validFiles, errors } = validateFiles(fileArray)
    
    if (errors.length > 0) {
      alert(`Validation Errors:\n${errors.join('\n')}`)
    }
    
    if (validFiles.length > 0) {
      setSelectedFiles(validFiles)
      setCompressedResults([])
      // Auto-start compression when files are selected
      startCompression(validFiles)
    }
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files)
    }
  }

  const startCompression = async (filesToCompress) => {
    setIsCompressing(true)
    setProcessingProgress(0)
    const results = []
    
    try {
      for (let i = 0; i < filesToCompress.length; i++) {
        const file = filesToCompress[i]
        
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('quality', quality.toString())

          const response = await fetch('/api/compress', {
            method: 'POST',
            body: formData
          })

          if (response.ok) {
            const compressedBlob = await response.blob()
            const originalSize = parseInt(response.headers.get('X-Original-Size'))
            const compressedSize = parseInt(response.headers.get('X-Compressed-Size'))
            const compressionRatio = response.headers.get('X-Compression-Ratio')

            results.push({
              originalFile: file,
              compressedBlob,
              originalSize,
              compressedSize,
              compressionRatio,
              status: 'success'
            })
          } else {
            results.push({
              originalFile: file,
              status: 'error',
              error: 'Compression failed'
            })
          }
        } catch (error) {
          results.push({
            originalFile: file,
            status: 'error',
            error: error.message
          })
        }
        
        // Update progress
        setProcessingProgress(((i + 1) / filesToCompress.length) * 100)
        setCompressedResults([...results])
      }
    } catch (error) {
      console.error('Compression failed:', error)
      alert('Compression failed. Please try again.')
    } finally {
      setIsCompressing(false)
    }
  }

  const downloadSingle = (result) => {
    const url = URL.createObjectURL(result.compressedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compressed_${result.originalFile.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadAllAsZip = async () => {
    // Dynamically import JSZip
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    
    // Add each compressed file to zip
    compressedResults.forEach((result, index) => {
      if (result.status === 'success') {
        const filename = `compressed_${result.originalFile.name}`
        zip.file(filename, result.compressedBlob)
      }
    })
    
    // Generate and download zip
    zip.generateAsync({ type: 'blob' }).then((zipBlob) => {
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'compressed_images.zip'
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const clearFiles = () => {
    setSelectedFiles([])
    setCompressedResults([])
    setProcessingProgress(0)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getTotalStats = () => {
    const successfulResults = compressedResults.filter(r => r.status === 'success')
    if (successfulResults.length === 0) return null
    
    const totalOriginal = successfulResults.reduce((sum, r) => sum + r.originalSize, 0)
    const totalCompressed = successfulResults.reduce((sum, r) => sum + r.compressedSize, 0)
    const totalReduction = ((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(1)
    
    return {
      originalSize: formatFileSize(totalOriginal),
      compressedSize: formatFileSize(totalCompressed),
      reduction: totalReduction,
      filesProcessed: successfulResults.length
    }
  }

  const totalStats = getTotalStats()

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            PNG Super Compressor
          </h1>
          <p className="text-lg text-gray-600">
            Advanced PNG compression - up to 80% size reduction
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Upload up to 50 PNG files (max 10MB each) • Auto compression • Zip download
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div 
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 
                  selectedFiles.length > 0 ? 'border-green-500 bg-green-50' : 
                  'border-gray-300 hover:border-blue-400'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/png"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                
                {selectedFiles.length === 0 ? (
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <svg className="mx-auto h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-xl font-semibold mb-2">
                      {isDragging ? 'Drop your PNGs here!' : 'Drop your PNGs or click to Browse'}
                    </p>
                    <p className="text-gray-500">
                      Select up to 50 PNG files (max 10MB each)
                    </p>
                  </label>
                ) : (
                  <div className="space-y-3">
                    <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-semibold">
                        {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                      </p>
                      <p className="text-gray-500">
                        {formatFileSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))} total
                      </p>
                    </div>
                    <button
                      onClick={clearFiles}
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      Select Different Files
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quality Controls */}
            {selectedFiles.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Compression Settings</h3>
                
                {/* Quality Presets */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-3">PNG Quality</label>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {qualityPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setQuality(preset.value)}
                        className={`px-3 py-2 rounded-lg border font-medium text-sm ${
                          quality === preset.value
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Quality Slider */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Custom Quality: <span className="font-bold text-blue-600">{quality}%</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Smaller Size</span>
                    <span>Better Quality</span>
                  </div>
                </div>

                {/* Processing Progress */}
                {isCompressing && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Processing...</span>
                      <span>{processingProgress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{width: `${processingProgress}%`}}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {/* Total Stats */}
            {totalStats && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  ✨ Total Results
                  <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                    {totalStats.reduction}% saved
                  </span>
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Original:</span>
                    <span className="font-semibold">{totalStats.originalSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Compressed:</span>
                    <span className="font-semibold text-green-600">{totalStats.compressedSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Files:</span>
                    <span className="font-semibold">{totalStats.filesProcessed}</span>
                  </div>
                </div>

                {/* Download Buttons */}
                <div className="mt-6 space-y-3">
                  {compressedResults.length === 1 && compressedResults[0].status === 'success' ? (
                    <button
                      onClick={() => downloadSingle(compressedResults)}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg"
                    >
                      📥 Download PNG
                    </button>
                  ) : compressedResults.filter(r => r.status === 'success').length > 1 ? (
                    <button
                      onClick={downloadAllAsZip}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg"
                    >
                      📦 Download All as ZIP
                    </button>
                  ) : null}
                  
                  <button
                    onClick={clearFiles}
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                  >
                    🔄 Compress More Files
                  </button>
                </div>
              </div>
            )}

            {/* File List */}
            {compressedResults.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">File Status</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {compressedResults.map((result, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {result.originalFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(result.originalFile.size)}
                          {result.status === 'success' && (
                            <> → {formatFileSize(result.compressedSize)} (-{result.compressionRatio}%)</>
                          )}
                        </p>
                      </div>
                      <div className="ml-2">
                        {result.status === 'success' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Done
                          </span>
                        ) : result.status === 'error' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ✗ Error
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⏳ Processing
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>
            🔒 Your PNG images are processed securely using advanced WebP algorithms and output as optimized PNG files
          </p>
        </div>
      </div>
    </div>
  )
}
