const Select = ({
  label,
  error,
  required = false,
  options = [],
  className = '',
  showPlaceholder = true,
  placeholderLabel = 'Select an option',
  ...props
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        {...props}
      >
        {showPlaceholder && <option value="">{placeholderLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default Select;
