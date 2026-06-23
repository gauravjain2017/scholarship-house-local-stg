import { useEffect } from 'react';

const NotificationModal = ({ isOpen, onClose, title, message, type = 'success', closeOnBackdrop = true }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const config = {
    success: {
      icon: (
        <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      titleColor: 'text-green-700',
      bgAccent: 'bg-green-50',
      borderColor: 'border-green-200',
      buttonClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      defaultTitle: 'Success',
    },
    error: {
      icon: (
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      titleColor: 'text-red-700',
      bgAccent: 'bg-red-50',
      borderColor: 'border-red-200',
      buttonClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      defaultTitle: 'Error',
    },
    warning: {
      icon: (
        <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
      titleColor: 'text-yellow-700',
      bgAccent: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      buttonClass: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
      defaultTitle: 'Warning',
    },
    info: {
      icon: (
        <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      titleColor: 'text-blue-700',
      bgAccent: 'bg-blue-50',
      borderColor: 'border-blue-200',
      buttonClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      defaultTitle: 'Info',
    },
  };

  const { icon, titleColor, bgAccent, borderColor, buttonClass, defaultTitle } = config[type] || config.info;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={closeOnBackdrop ? onClose : undefined}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className={`${bgAccent} ${borderColor} border-b flex items-center gap-3 px-6 py-4`}>
            <span className="flex-shrink-0">{icon}</span>
            <h3 className={`text-lg font-semibold ${titleColor}`}>
              {title || defaultTitle}
            </h3>
            <button
              onClick={onClose}
              className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 overflow-y-auto text-gray-700 text-sm text-left whitespace-pre-line">
            {message}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className={`px-6 py-2.5 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonClass}`}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
