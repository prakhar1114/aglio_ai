import { useState, useRef } from 'react';
import { CloudArrowUpIcon, XMarkIcon, LinkIcon } from '@heroicons/react/24/outline';
import { constructImageUrl } from '../utils/media';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function ImageUpload({ 
  currentImageUrl, 
  currentCloudflareImageId, 
  currentCloudflareVideoId,
  onImageChange,
  onVideoChange,
  className = ""
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      alert('Please select an image or video file');
      return;
    }

    setUploading(true);
    try {
      // Upload to Cloudflare via our API
      const result = await apiService.uploadMedia(user.api_key, file);
      
      if (isVideo) {
        onVideoChange(result.cloudflare_video_id);
      } else {
        onImageChange(result.cloudflare_image_id);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) {
      alert('Please enter a URL');
      return;
    }

    setUploading(true);
    try {
      // Upload URL to Cloudflare via our API
      const result = await apiService.uploadMediaFromUrl(user.api_key, urlInput);
      
      if (result.cloudflare_video_id) {
        onVideoChange(result.cloudflare_video_id);
      } else if (result.cloudflare_image_id) {
        onImageChange(result.cloudflare_image_id);
      }
      
      setUrlInput('');
      setShowUrlInput(false);
    } catch (error) {
      console.error('URL upload error:', error);
      alert('Failed to upload from URL. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const getCurrentMediaInfo = () => {
    return constructImageUrl(
      currentImageUrl,
      currentCloudflareImageId,
      currentCloudflareVideoId,
      'medium'
    );
  };

  const mediaInfo = getCurrentMediaInfo();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Current Image/Video Display */}
      {mediaInfo && (
        <div className="relative">
          <div className="w-full h-48 bg-gray-200 rounded-lg overflow-hidden">
            {mediaInfo.type === 'video' ? (
              <img 
                src={mediaInfo.thumbnail} 
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            ) : mediaInfo.type === 'image' ? (
              <img 
                src={mediaInfo.url} 
                alt="Menu item"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400">No media</span>
              </div>
            )}
          </div>
          
          {/* Remove button */}
          {(currentCloudflareImageId || currentCloudflareVideoId) && (
            <button
              type="button"
              onClick={() => {
                onImageChange(null);
                onVideoChange(null);
              }}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive 
            ? 'border-red-400 bg-red-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        
        <div className="space-y-2">
          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="text-sm text-gray-600">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-red-600 hover:text-red-500 font-medium"
            >
              {uploading ? 'Uploading...' : 'Click to upload'}
            </button>
            {' '}or drag and drop
          </div>
          <p className="text-xs text-gray-500">
            PNG, JPG, GIF, MP4 up to 10MB
          </p>
          
          <div className="border-t pt-2">
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              disabled={uploading}
              className="text-blue-600 hover:text-blue-500 font-medium text-sm"
            >
              <LinkIcon className="h-4 w-4 inline mr-1" />
              Upload from URL
            </button>
          </div>
          
          {showUrlInput && (
            <div className="space-y-2 pt-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter Google Drive, Instagram, or direct URL"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleUrlUpload}
                  disabled={uploading || !urlInput.trim()}
                  className="flex-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUrlInput(false);
                    setUrlInput('');
                  }}
                  className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageUpload; 