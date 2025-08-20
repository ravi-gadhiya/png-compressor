'use client'
import { useState, useEffect } from 'react'
import JSZip from 'jszip'

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [compressedResults, setCompressedResults] = useState([])
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionProgress, setCompressionProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [quality, setQuality] = useState(100)
  const [totalStats, setTotalStats] = useState(null)

  // Quality presets
  const qualityPresets = [
    { label: '20%', value: 20 },
    { label: '40%', value: 40 },
    { label: '60%', value: 60 },
    { label: '80%', value: 80 },
    { label: 'Max', value: 100 }
  ]

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files)
    
    // Validate file limits (max 50 files, max 10MB each)
    const validFiles = fileArray
      .filter(file => file.type.startsWith('image/'))
      .filter(file => file.size <= 10 * 1024 * 1024) // 10MB limit
      .slice(0, 50) // Max 50 files
    
    if (fileArray.length > validFiles.length) {
      const rejected = fileArray.length - validFiles.length
      alert(`${rejected} file(s) were rejected. Only image files under 10MB are accepted. Maximum 50 files allowed.`)
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles)
      setCompressedResults([])
      setTotalStats(null)
      // Auto-start compression immediately
      compressImages(validFiles)
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

  // Auto compression function (no button required)
  const compressImages = async (files) => {
    setIsCompressing(true)
    setCompressionProgress(0)
    
    const results = []
    let totalOriginalSize = 0
    let totalCompressedSize = 0
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
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

          totalOriginalSize += originalSize
          totalCompressedSize += compressedSize
        } else {
          results.push({
            originalFile: file,
            status: 'error',
            error: 'Compression failed'
          })
        }
        
        // Update progress
        setCompressionProgress(Math.round(((i + 1) / files.length) * 100))
      }

      setCompressedResults(results)
      
      // Calculate total stats
      const totalReduction = ((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(1)
      const totalSavedKB = ((totalOriginalSize - totalCompressedSize) / 1024).toFixed(0)
      
      setTotalStats({
        originalSize: (totalOriginalSize / 1024 / 1024).toFixed(2),
        compressedSize: (totalCompressedSize / 1024 / 1024).toFixed(2),
        reduction: totalReduction,
        savedKB: totalSavedKB,
        filesProcessed: results.filter(r => r.status === 'success').length
      })

    } catch (error) {
      console.error('Compression failed:', error)
      alert('Compression failed. Please try again.')
    } finally {
      setIsCompressing(false)
      setCompressionProgress(0)
    }
  }

  // Download single file
  const downloadFile = (result) => {
    const url = URL.createObjectURL(result.compressedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compressed_${result.originalFile.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Download all files as ZIP
  const downloadAllAsZip = async () => {
    const zip = new JSZip()
    const successfulResults = compressedResults.filter(r => r.status === 'success')
    
    // Add all compressed files to ZIP
    successfulResults.forEach((result, index) => {
      const fileName = `compressed_${result.originalFile.name}`
      zip.file(fileName, result.compressedBlob)
    })
    
    // Generate ZIP file and download
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compressed-images-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearAll = () => {
    setSelectedFiles([])
    setCompressedResults([])
    setTotalStats(null)
    setCompressionProgress(0)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Batch Image Compressor
          </h1>
          <p className="text-lg text-gray-600">
            Upload up to 50 images (10MB each) - Auto compression with ZIP download
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Area & Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upload Area */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
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
                  accept="image/*"
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
                      {isDragging ? 'Drop your images here!' : 'Drop images or click to Browse'}
                    </p>
                    <p className="text-gray-500">
                      Up to 50 images, 10MB each. Auto compression starts instantly!
                    </p>
                  </label>
                ) : (
                  <div className="space-y-3">
                    <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-semibold">{selectedFiles.length} files selected</p>
                      <p className="text-gray-500">
                        {(selectedFiles.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(2)} MB total
                      </p>
                    </div>
                    <button
                      onClick={clearAll}
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      Clear All Files
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
                  <label className="block text-sm font-medium mb-3">Quality Level</label>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {qualityPresets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setQuality(preset.value)}
                        disabled={isCompressing}
                        className={`px-3 py-2 rounded-lg border font-medium text-sm ${
                          quality === preset.value
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                        } ${isCompressing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Quality Slider */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Custom: <span className="font-bold text-blue-600">{quality}%</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    disabled={isCompressing}
                    onChange={(e) => setQuality(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                  />
                </div>

                {/* Re-compress with new quality */}
                {compressedResults.length > 0 && !isCompressing && (
                  <button
                    onClick={() => compressImages(selectedFiles)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg"
                  >
                    🔄 Re-compress with {quality}% quality
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Bar */}
            {isCompressing && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Processing Images... {compressionProgress}%
                </h3>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${compressionProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Results Table */}
            {selectedFiles.length > 0 && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                      Files ({selectedFiles.length})
                    </h3>
                    {compressedResults.length > 0 && !isCompressing && (
                      <div className="flex gap-2">
                        <button
                          onClick={downloadAllAsZip}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                          📦 Download ZIP
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Before</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">After</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saved</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedFiles.map((file, index) => {
                        const result = compressedResults.find(r => r.originalFile === file)
                        return (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-32">
                              {file.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {result?.status === 'success' ? formatFileSize(result.compressedSize) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              {!result ? (
                                <span className="text-sm text-yellow-600">Processing...</span>
                              ) : result.status === 'success' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  -{result.compressionRatio}%
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Error
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {result?.status === 'success' ? (
                                <button
                                  onClick={() => downloadFile(result)}
                                  className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                                >
                                  Download
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Total Stats */}
            {totalStats && (
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-md p-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-2">
                    🎉 Total Saved: {totalStats.savedKB} KB ({totalStats.reduction}% reduction)
                  </h3>
                  <p className="text-green-100">
                    {totalStats.filesProcessed} file{totalStats.filesProcessed > 1 ? 's' : ''} processed • 
                    {totalStats.originalSize} MB → {totalStats.compressedSize} MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
