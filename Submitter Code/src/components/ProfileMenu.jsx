import { useState, useRef, useEffect } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatPhoneDisplay } from '../utils/format';

// Utility to map userType to label
function getUserTypeLabel(type) {
  if (!type) return '';
  const map = {
 
    submitter: 'Submitter',
    validator: 'Validator',
    real_estate_professional: 'Real Estate Professional',
    realtor: 'Realtor',
    wholesaler: 'Wholesaler',
    birddogger: 'Bird Dogger',
    
  };
  return (
    map[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
  );
}

const ProfileMenu = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);


  if (!user) {
    return (
      <div className="flex items-center ml-4 text-[#072B53]">
        <FaUserCircle className="text-2xl" />
        <span className="ml-2 text-sm">Account</span>
      </div>
    );
  }

  const handleLogout = () => {
    setShowConfirm(false);
    logout();
  };

  return (
    <div
      className="relative flex items-center ml-4"
      ref={menuRef}
    >
      <button
        className="flex items-center space-x-2 focus:outline-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="font-medium text-[#072B53]">
          {user.name || user.email || 'Account'}
        </span>
        <FaUserCircle className="text-2xl text-[#072B53]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-[#6F91C6] rounded-lg shadow-lg z-50 p-4 text-sm">
          <div className="mb-2">
            <span className="font-semibold text-primary">Email:</span>{' '}
            {user.email}
          </div>
          <div className="mb-2">
            <span className="font-semibold text-primary">Phone:</span>{' '}
            {user.phone ? formatPhoneDisplay(user.phone) : 'N/A'}
          </div>
          <div className="mb-4">
            <span className="font-semibold text-[#072B53]">User Type:</span>{' '}
            {getUserTypeLabel(user.userType)}
          </div>

          {/* <Link
            to="/disputes"
            className="block w-full py-2 mb-2 text-center bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-medium transition-colors"
          >
            My Disputes
          </Link> */}

          <button
            className="w-full py-2 mt-2 bg-accent hover:bg-accent-light text-white rounded font-semibold transition-colors"
            onClick={() => setShowConfirm(true)}
          >
            Log Out
          </button>

          {showConfirm && (
            <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
              <div className="bg-surface rounded-lg shadow-lg p-6 w-80">
                <div className="mb-4 text-lg font-semibold text-primary">
                  Are you sure you want to log out?
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded bg-accent hover:bg-accent-light text-white"
                    onClick={handleLogout}
                  >
                    Yes, Log Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
