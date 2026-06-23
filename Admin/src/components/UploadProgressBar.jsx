/**
 * Upload Progress Bar Component
 *
 * Displays progress during file uploads with:
 * - Overall stage indicator (e.g., "Uploading Interior Photos")
 * - File count progress (e.g., "3 of 10 files")
 * - Visual progress bar with percentage
 * - Current file upload progress
 */

const UploadProgressBar = ({
  stage, // Current upload stage label (e.g., "Interior Photos")
  completed, // Number of files completed
  total, // Total number of files
  currentFileProgress = 0, // Progress of current file (0-100)
  isVisible = true,
}) => {
  if (!isVisible || !stage) return null;

  // Calculate overall progress including current file
  const filesProgress = total > 0 ? (completed / total) * 100 : 0;
  const currentContribution = total > 0 ? currentFileProgress / total : 0;
  const overallProgress = Math.min(100, filesProgress + currentContribution);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Uploading Files
            </h3>
            <p className="text-sm text-gray-500">
              Please wait while your files are being uploaded
            </p>
          </div>
        </div>

        {/* Stage indicator */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">{stage}</span>
            <span className="text-sm text-gray-500">
              {completed} of {total} files
            </span>
          </div>

          {/* Overall progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="text-right mt-1">
            <span className="text-xs text-gray-500">
              {Math.round(overallProgress)}% complete
            </span>
          </div>
        </div>

        {/* Current file progress (if uploading) */}
        {currentFileProgress > 0 && currentFileProgress < 100 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500">Current file</span>
              <span className="text-xs text-gray-500">
                {currentFileProgress}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-150"
                style={{ width: `${currentFileProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Tip message */}
        <p className="mt-6 text-xs text-gray-400 text-center">
          Do not close this window or navigate away during upload
        </p>
      </div>
    </div>
  );
};

export default UploadProgressBar;
