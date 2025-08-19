'use client'
import { useState } from 'react'

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [compressedBlob, setCompressedBlob] = useState(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionStats, setCompressionStats] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [quality, setQuality] = useState(100)
  const [format, setFormat] = useState('webp')

  // Quality presets like Compressor.io
  const qualityPresets = [
    { label: '20%', value: 20 },
    { label: '40%', value: 40 },
    { label: '60%', value: 60 },
    { label: '80%', value: 80 },
    { label: 'Max', value: 95 }
  ]

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      setCompressedBlob(null)
      setCompressionStats(null)
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
      handleFileSelect(files[0])
    }
  }

  const compressImage = async () => {
    if (!selectedFile) return
    
    setIsCompressing(true)
    
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('quality', quality.toString())
      formData.append('format', format)

      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Compression failed')
      }

      const compressedBlob = await response.blob()
      setCompressedBlob(compressedBlob)

      // Get compression stats from headers
      const originalSize = parseInt(response.headers.get('X-Original-Size'))
      const compressedSize = parseInt(response.headers.get('X-Compressed-Size'))
      const compressionRatio = response.headers.get('X-Compression-Ratio')

      setCompressionStats({
        original: (originalSize / 1024 / 1024).toFixed(2),
        compressed: (compressedSize / 1024 / 1024).toFixed(2),
        reduction: compressionRatio
      })

    } catch (error) {
      console.error('Compression failed:', error)
      alert('Compression failed. Please try again.')
    } finally {
      setIsCompressing(false)
    }
  }

  const downloadCompressed = () => {
    if (!compressedBlob) return
    
    const url = URL.createObjectURL(compressedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compressed_${selectedFile.name}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Professional Image Compressor
          </h1>
          <p className="text-gray-600">
            Advanced compression using Sharp & ImageMin - up to 80% size reduction
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload & Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Area */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 
                  selectedFile ? 'border-green-500 bg-green-50' : 
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
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                />
                
                {!selectedFile ? (
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <svg className="mx-auto h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-xl font-semibold mb-2 text-gray-900">
                      {isDragging ? 'Drop your images here!' : 'Drop your images or click to Browse'}
                    </p>
                    <p className="text-gray-500">
                      compress jpg, png, gif, svg, webp. Max 10 MB.
                    </p>
                  </label>
                ) : (
                  <div className="space-y-3">
                    <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-semibold">{selectedFile.name}</p>
                      <p className="text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quality Controls - Like Compressor.io */}
            {selectedFile && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Image Quality</h3>
                
                {/* Quality Presets */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {qualityPresets.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setQuality(preset.value)}
                      className={`px-4 py-2 rounded-lg border font-medium ${
                        quality === preset.value
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Quality Slider */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-gray-900">
                    Custom Quality: {quality}%
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

                {/* Format Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-900">Output Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full p-2 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="auto">Auto (Keep Original)</option>
                    <option value="jpeg">JPEG</option>
                    <option value="png">PNG</option>
                    <option value="webp">WebP (Best Compression)</option>
                  </select>
                </div>

                {/* Compress Button */}
                <button
                  onClick={compressImage}
                  disabled={isCompressing}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {isCompressing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Compress Image'
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Results Panel */}
          {compressionStats && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">✨ Results</h3>
              
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-red-600">{compressionStats.original} MB</p>
                  <p className="text-sm text-gray-500">Before</p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{compressionStats.compressed} MB</p>
                  <p className="text-sm text-gray-500">After</p>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">{compressionStats.reduction}%</p>
                  <p className="text-sm text-gray-500">Saved</p>
                </div>
              </div>

              <button
                onClick={downloadCompressed}
                className="w-full mt-6 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                📥 Download
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
