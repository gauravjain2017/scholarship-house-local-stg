import { useState } from 'react';

const ImageCarousel = ({
  images,
  alt = 'Image',
  className = '',
  counterOnHover = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [failedSet, setFailedSet] = useState(() => new Set());

  const allImages = (images || []).filter(
    (img) => typeof img === 'string' && img.trim().length > 0
  );

  // Build display list excluding failed images, preserving original indices
  const displayImages = allImages
    .map((src, i) => ({ src, i }))
    .filter(({ i }) => !failedSet.has(i));

  if (displayImages.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
      >
        No Image
      </div>
    );
  }

  // Clamp in case images were removed after currentIndex was set
  const safeIndex = Math.min(currentIndex, displayImages.length - 1);

  const handleImageError = (origIdx) => {
    setFailedSet((prev) => new Set([...prev, origIdx]));
  };

  const goToPrevious = () =>
    setCurrentIndex((p) => (p === 0 ? displayImages.length - 1 : p - 1));

  const goToNext = () =>
    setCurrentIndex((p) => (p === displayImages.length - 1 ? 0 : p + 1));

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* All images rendered at once — hidden ones are preloaded by the browser,
          so navigation is instant instead of waiting for a new network request */}
      {allImages.map((src, origIdx) => {
        if (failedSet.has(origIdx)) return null;
        const displayIdx = displayImages.findIndex((d) => d.i === origIdx);
        const isActive = displayIdx === safeIndex;
        return (
          <img
            key={origIdx}
            src={src}
            alt={`${alt} ${displayIdx + 1}`}
            className={`w-full h-full object-cover${
              isActive ? '' : ' absolute inset-0 opacity-0 pointer-events-none'
            }`}
            onError={() => handleImageError(origIdx)}
          />
        );
      })}

      {displayImages.length > 1 && (
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
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all z-10"
                aria-label="Previous image"
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
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all z-10"
                aria-label="Next image"
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
            {displayImages.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === safeIndex
                    ? 'bg-surface w-6'
                    : 'bg-surface/50 hover:bg-surface/75'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>

          {/* Image Counter */}
          {counterOnHover === true && isHovered && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
              {safeIndex + 1} / {displayImages.length}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ImageCarousel;
