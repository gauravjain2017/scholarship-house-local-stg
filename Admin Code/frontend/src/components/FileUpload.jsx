import { useState, useEffect } from 'react';

const getMediaKey = (item) => {
  if (item instanceof File) {
    return `file:${item.name}-${item.size}-${item.lastModified}`;
  }

  if (typeof item === 'string') {
    // Normalize URL → filename only
    try {
      const url = new URL(item);
      return `url:${url.pathname.split('/').pop()}`;
    } catch {
      return `url:${item}`;
    }
  }

  return null;
};

const FileUpload = ({
  label,
  accept = 'image/*',
  multiple = false,
  value = [], // array of Files
  onChange, // receives array of URLs
  error,
  required = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState([]);
  const [hoveredVideo, setHoveredVideo] = useState(null);

  const isVideoUrl = (url) => /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(url);

  const makePreview = (item) => {
    if (typeof item === 'string') {
      return {
        url: item,
        type: isVideoUrl(item) ? 'video' : 'image',
        name: item.split('/').pop(),
        file: null,
      };
    }

    if (item instanceof File) {
      return {
        url: URL.createObjectURL(item),
        type: item.type.startsWith('video') ? 'video' : 'image',
        name: item.name,
        file: item,
      };
    }

    return null;
  };

  useEffect(() => {
    if (!Array.isArray(value) || value.length === 0) {
      setPreview([]);
      return;
    }

    const previews = value.map(makePreview).filter(Boolean);

    setPreview(previews);

    return () => {
      previews.forEach((p) => {
        if (p.file && p.url.startsWith('blob:')) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, [value, accept]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleFiles = (newFiles) => {
    if (!onChange || !newFiles?.length) return;

    const next = multiple ? [...value, ...newFiles] : newFiles;

    const unique = Array.from(
      new Map(
        next
          .map((item) => {
            const key = getMediaKey(item);
            return key ? [key, item] : null;
          })
          .filter(Boolean)
      ).values()
    );

    onChange(unique);
  };

  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        } ${error ? 'border-red-500' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            const files = Array.from(e.target.files);
            handleFiles(files);
            e.target.value = '';
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />

        {preview.length === 0 ? (
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <p className="mt-2 text-sm text-gray-600">
              Drag and drop files here, or click to select
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {accept === 'image/*'
                ? 'Images only'
                : accept === 'video/*'
                  ? 'Videos only'
                  : 'Any file type'}
            </p>
          </div>
        ) : (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 place-items-center relative z-20 min-h-[96px] max-h-[400px] overflow-y-auto"
            style={{ pointerEvents: 'none' }}
          >
            {preview.map((item, index) => (
              <div
                key={index}
                className="relative group w-full"
                style={{ pointerEvents: 'auto' }}
              >
                {item.type === 'image' ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-24 object-cover rounded border border-gray-200"
                  />
                ) : item.type === 'video' ? (
                  <div
                    className="w-full h-24 object-cover rounded border border-gray-200 bg-black relative"
                    onMouseEnter={() => setHoveredVideo(index)}
                    onMouseLeave={() => setHoveredVideo(null)}
                  >
                    <video
                      src={item.url}
                      controls={hoveredVideo === index}
                      className="w-full h-24 object-cover rounded bg-black"
                      style={{ pointerEvents: 'auto' }}
                    />
                    {/* Overlay a play icon when not hovered */}
                    {hoveredVideo !== index && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <svg
                          className="w-10 h-10 text-white opacity-80"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const updated = value.filter((_, i) => i !== index);
                    onChange(updated);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                <p className="text-xs text-gray-600 mt-1 truncate">
                  {item.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
