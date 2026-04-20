import { useEffect } from 'react';

const NotificationModal = ({ isOpen, onClose, title, message, type = 'success' }) => {
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
        <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="p-6 text-center">
            <div className="flex justify-center mb-4">{icon}</div>
            <h3 className={`text-xl font-semibold mb-3 ${titleColor}`}>
              {title || defaultTitle}
            </h3>
            <div className={`${bgAccent} ${borderColor} border rounded-lg p-4 mb-6`}>
              <p className="text-gray-700 text-sm">{message}</p>
            </div>
            <button
              onClick={onClose}
              className={`px-6 py-2.5 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonClass}`}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
