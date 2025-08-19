'use client'
import { useState, useRef } from 'react'

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [compressedResults, setCompressedResults] = useState([])
  const [isCompressing, setIsCompressing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [quality, setQuality] = useState(80)
  const [compressionType, setCompressionType] = useState('lossy')
  const [totalStats, setTotalStats] = useState(null)
  const fileInputRef = useRef(null)

  // Quality presets like Compressor.io
  const qualityPresets = [
    { label: '20', value: 20 },
    { label: '40', value: 40 },
    { label: '60', value: 60 },
    { label: '80', value: 80 },
    { label: 'max', value: 95 }
  ]

  const compressionTypes = [
    { 
      id: 'lossy', 
      label: 'Lossy', 
      description: 'Best compression (60-95% smaller)',
      icon: '🚀' 
    },
    { 
      id: 'lossless', 
      label: 'Lossless', 
      description: 'Best quality (5-20% smaller)',
      icon: '💎' 
    },
    { 
      id: 'custom', 
      label: 'Custom', 
      description: 'Smart optimization',
      icon: '⚡' 
    }
  ]

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files).slice(0, 10) // Limit to 10 files like Compressor.io
    const validFiles = fileArray.filter(file => file.type.startsWith('image/'))
    setSelectedFiles(validFiles)
    setCompressedResults([])
    setTotalStats(null)
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

  const compressImages = async () => {
    if (selectedFiles.length === 0) return
    
    setIsCompressing(true)
    const results = []
    let totalOriginalSize = 0
    let totalCompressedSize = 0
    
    try {
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('quality', quality.toString())
        formData.append('compressionType', compressionType)

        const response = await fetch('/api/compress', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const compressedBlob = await response.blob()
          const originalSize = parseInt(response.headers.get('X-Original-Size'))
          const compressedSize = parseInt(response.headers.get('X-Compressed-Size'))
          const compressionRatio = response.headers.get('X-Compression-Ratio')
          const sizeSavedKB = response.headers.get('X-Size-Saved-KB')
          const outputFormat = response.headers.get('X-Output-Format')

          results.push({
            originalFile: file,
            compressedBlob,
            originalSize,
            compressedSize,
            compressionRatio,
            sizeSavedKB,
            outputFormat,
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
    }
  }

  const downloadFile = (result) => {
    const url = URL.createObjectURL(result.compressedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compressed_${result.originalFile.name.split('.')[0]}.${result.outputFormat}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadAll = () => {
    compressedResults.forEach(result => {
      if (result.status === 'success') {
        setTimeout(() => downloadFile(result), 100)
      }
    })
  }

  const clearList = () => {
    setSelectedFiles([])
    setCompressedResults([])
    setTotalStats(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
            Fast & efficient image compression
          </h1>
          <p className="text-lg text-gray-600">
            Optimize <span className="font-semibold">JPEG, PNG, SVG, GIF</span> and <span className="font-semibold">WEBP</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Compression Type */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Compression type</h3>
              <div className="space-y-3">
                {compressionTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setCompressionType(type.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      compressionType === type.id
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{type.icon}</span>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-gray-500">{type.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Settings */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Image quality</h3>
              
              {/* Format-specific quality presets */}
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">JPG:</div>
                <div className="flex gap-1">
                  {qualityPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setQuality(preset.value)}
                      className={`px-3 py-1 text-sm rounded border ${
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
              <div>
                <label className="block text-sm font-medium mb-2">
                  Custom: <span className="font-bold text-blue-600">{quality}</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="95"
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
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
                  ref={fileInputRef}
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
                    {isDragging ? 'Drop your images here!' : 'drop your images or click to Browse'}
                  </p>
                  <p className="text-gray-500">
                    compress jpg, png, gif, svg, webp. Max 10 MB.
                  </p>
                </label>
              </div>

              {/* Action Buttons */}
              {selectedFiles.length > 0 && (
                <div className="mt-6 flex gap-4">
                  <button
                    onClick={compressImages}
                    disabled={isCompressing}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 disabled:cursor-not-allowed"
                  >
                    {isCompressing ? 'Processing...' : `Compress ${selectedFiles.length} image${selectedFiles.length > 1 ? 's' : ''}`}
                  </button>
                  <button
                    onClick={clearList}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Clear list
                  </button>
                </div>
              )}
            </div>

            {/* Results Table */}
            {selectedFiles.length > 0 && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Processing Results</h3>
                    {compressedResults.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          onClick={downloadAll}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          Download All
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Before</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">After</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedFiles.map((file, index) => {
                        const result = compressedResults.find(r => r.originalFile === file)
                        return (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {file.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {!result ? (
                                <span className="text-sm text-gray-500">Waiting...</span>
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {result?.status === 'success' ? formatFileSize(result.compressedSize) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {result?.status === 'success' ? (
                                <button
                                  onClick={() => downloadFile(result)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
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
                    🎉 Saved: {totalStats.savedKB} KB ({totalStats.reduction}% reduction)
                  </h3>
                  <p className="text-green-100">
                    {totalStats.filesProcessed} image{totalStats.filesProcessed > 1 ? 's' : ''} processed • 
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
