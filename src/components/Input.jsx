const Input = ({
  label,
  error,
  type = 'text',
  required = false,
  className = '',
  ...props
}) => {
  // Prevent e, E, +, - in number fields
  const handleKeyDown = (e) => {
    if (type === 'number' && ['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
    if (props.onKeyDown) props.onKeyDown(e);
  };
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        onKeyDown={handleKeyDown}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default Input;
