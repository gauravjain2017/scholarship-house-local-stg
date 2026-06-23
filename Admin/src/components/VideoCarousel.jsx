import { useState } from 'react';

const VideoCarousel = ({ videos, className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [failedVideos, setFailedVideos] = useState([]);

  // Filter out failed videos
  const validVideos = (videos || []).filter(
    (vid, idx) =>
      !failedVideos.includes(idx) &&
      ((typeof vid === 'string' && vid.trim().length > 0) ||
        (vid && typeof vid === 'object' && vid.url))
  );

  // If all videos fail or none provided, show fallback
  if (!validVideos || validVideos.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
      >
        No Video
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? validVideos.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === validVideos.length - 1 ? 0 : prevIndex + 1
    );
  };

  const handleVideoError = () => {
    setFailedVideos((prev) => [...prev, currentIndex]);
  };

  // Get video src
  const getVideoSrc = (vid) => {
    if (typeof vid === 'string') return vid;
    if (vid && typeof vid === 'object' && vid.url) return vid.url;
    return '';
  };

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <video
        src={getVideoSrc(validVideos[currentIndex])}
        controls
        className="w-full h-full object-contain bg-black rounded-lg"
        onError={handleVideoError}
      />

      {validVideos.length > 1 && (
        <>
          {/* Navigation Arrows */}
          {isHovered && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  goToPrevious();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-surface/70 hover:bg-surface text-gray-900 rounded-full w-8 h-8 flex items-center justify-center transition-all z-10"
                aria-label="Previous video"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  goToNext();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface/70 hover:bg-surface text-gray-900 rounded-full w-8 h-8 flex items-center justify-center transition-all z-10"
                aria-label="Next video"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </>
          )}

          {/* Dot Indicators */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
            {validVideos.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-accent'
                    : 'bg-surface/50 hover:bg-surface/75'
                }`}
                aria-label={`Go to video ${index + 1}`}
              />
            ))}
          </div>

          {/* Video Counter */}
          {isHovered && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
              {currentIndex + 1} / {validVideos.length}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VideoCarousel;
