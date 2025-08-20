'use client'
import { useState } from 'react'

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [processingFiles, setProcessingFiles] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [quality, setQuality] = useState(100)

  // Quality presets
  const qualityPresets = [
    { label: '20%', value: 20 },
    { label: '40%', value: 40 },
    { label: '60%', value: 60 },
    { label: '80%', value: 80 },
    { label: 'Max', value: 100 }
  ]

  const validateAndProcessFiles = async (files) => {
    const fileArray = Array.from(files)
    
    // Validate file count (max 50)
    if (fileArray.length > 50) {
      alert('Maximum 50 files allowed at once.')
      return
    }

    // Validate file types and sizes
    const validFiles = []
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file. Skipping.`)
        continue
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert(`${file.name} is larger than 10MB. Skipping.`)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) {
      return
    }

    setSelectedFiles(validFiles)
    setProcessingFiles([])
    
    // Auto-start compression immediately
    await compressMultipleFiles(validFiles)
  }

  const handleFileSelect = (files) => {
    validateAndProcessFiles(files)
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

  const compressMultipleFiles = async (filesToProcess) => {
    setIsProcessing(true)
    const results = []

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i]
        
        // Update processing status
        setProcessingFiles(prev => [
          ...prev.filter(p => p.name !== file.name),
          { name: file.name, status: 'processing', originalSize: file.size }
        ])

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

            // Update status to completed
            setProcessingFiles(prev => [
              ...prev.filter(p => p.name !== file.name),
              {
                name: file.name,
                status: 'completed',
                originalSize: file.size,
                compressedSize,
                compressionRatio
              }
            ])
          } else {
            // Update status to failed
            setProcessingFiles(prev => [
              ...prev.filter(p => p.name !== file.name),
              {
                name: file.name,
                status: 'failed',
                originalSize: file.size,
                error: 'Compression failed'
              }
            ])
          }
        } catch (error) {
          setProcessingFiles(prev => [
            ...prev.filter(p => p.name !== file.name),
            {
              name: file.name,
              status: 'failed',
              originalSize: file.size,
              error: error.message
            }
          ])
        }
      }

      // Store results for download
      setProcessingFiles(prev => prev.map(file => ({
        ...file,
        result: results.find(r => r.originalFile.name === file.name)
      })))

    } catch (error) {
      console.error('Batch compression failed:', error)
      alert('Batch compression failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadAsZip = async () => {
    const successfulFiles = processingFiles.filter(f => f.status === 'completed' && f.result)
    
    if (successfulFiles.length === 0) {
      alert('No files to download.')
      return
    }

    // Import JSZip dynamically
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    // Add files to zip
    successfulFiles.forEach(file => {
      const originalName = file.name.split('.')[0]
      zip.file(`compressed_${originalName}.png`, file.result.compressedBlob)
    })

    // Generate zip and download
    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `compressed_images_${new Date().getTime()}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to create zip:', error)
      alert('Failed to create zip file.')
    }
  }

  const clearAll = () => {
    setSelectedFiles([])
    setProcessingFiles([])
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const totalStats = processingFiles.length > 0 ? {
    total: processingFiles.length,
    completed: processingFiles.filter(f => f.status === 'completed').length,
    failed: processingFiles.filter(f => f.status === 'failed').length,
    processing: processingFiles.filter(f => f.status === 'processing').length,
    totalOriginalSize: processingFiles.reduce((acc, f) => acc + (f.originalSize || 0), 0),
    totalCompressedSize: processingFiles.filter(f => f.status === 'completed').reduce((acc, f) => acc + (f.compressedSize || 0), 0)
  } : null

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            PNG Batch Compressor
          </h1>
          <p className="text-lg text-gray-600">
            Upload up to 50 images (max 10MB each) - WebP compression with PNG output
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Quality Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h3 className="text-lg font-semibold mb-4">Compression Quality</h3>
              
              {/* Quality Presets */}
              <div className="mb-4">
                <div className="grid grid-cols-5 gap-1 mb-4">
                  {qualityPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setQuality(preset.value)}
                      className={`px-2 py-2 rounded border text-xs font-medium ${
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
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Quality: <span className="font-bold text-blue-600">{quality}%</span>
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
                  <span>Smaller</span>
                  <span>Better</span>
                </div>
              </div>

              {/* Stats */}
              {totalStats && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Processing Stats</h4>
                  <div className="space-y-1 text-sm">
                    <div>Total: {totalStats.total} files</div>
                    <div className="text-green-600">✓ Completed: {totalStats.completed}</div>
                    {totalStats.processing > 0 && (
                      <div className="text-blue-600">⏳ Processing: {totalStats.processing}</div>
                    )}
                    {totalStats.failed > 0 && (
                      <div className="text-red-600">✗ Failed: {totalStats.failed}</div>
                    )}
                  </div>
                  
                  {totalStats.completed > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-600">
                        Saved: {formatFileSize(totalStats.totalOriginalSize - totalStats.totalCompressedSize)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Area */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div 
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 
                  'border-gray-300 hover:border-blue-400'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <svg className="mx-auto h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-xl font-semibold mb-2">
                    {isDragging ? 'Drop your images here!' : 'Drop images or click to Browse'}
                  </p>
                  <p className="text-gray-500">
                    Select up to 50 images • Max 10MB each • Auto-compression
                  </p>
                </label>
              </div>

              {processingFiles.length > 0 && (
                <div className="mt-6 flex gap-4">
                  <button
                    onClick={downloadAsZip}
                    disabled={processingFiles.filter(f => f.status === 'completed').length === 0}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    📦 Download All as ZIP ({processingFiles.filter(f => f.status === 'completed').length})
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Processing Results Table */}
            {processingFiles.length > 0 && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold">Processing Results</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compressed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saved</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {processingFiles.map((file, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <span className="truncate max-w-xs">{file.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatFileSize(file.originalSize)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {file.status === 'processing' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <svg className="animate-spin -ml-1 mr-2 h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing
                              </span>
                            )}
                            {file.status === 'completed' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✓ Done (-{file.compressionRatio}%)
                              </span>
                            )}
                            {file.status === 'failed' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ✗ Failed
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {file.status === 'completed' ? formatFileSize(file.compressedSize) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {file.status === 'completed' 
                              ? formatFileSize(file.originalSize - file.compressedSize)
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>
            🔒 Images processed securely • WebP compression with PNG output • Auto-processing on upload
          </p>
        </div>
      </div>
    </div>
  )
}
