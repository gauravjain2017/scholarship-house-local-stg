import { forwardRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parse, format, isValid } from 'date-fns';

const handleRawChange = (e) => {
  e.preventDefault();
};

const DateInput = forwardRef(
  (
    {
      label,
      value,
      onChange,
      error,
      name,
      placeholder = 'Select date',
      minDate,
      maxDate,
      required = false,
      disabled = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const parseValue = (val) => {
      if (!val) return null;
      const parsed = parse(val, 'MM/dd/yyyy', new Date());
      if (isValid(parsed)) return parsed;
      const iso = new Date(val);
      return isValid(iso) ? iso : null;
    };

    const handleChange = (date) => {
      if (!date) return onChange?.({ target: { name, value: '' } });
      onChange?.({ target: { name, value: format(date, 'MM/dd/yyyy') } });
    };

    const selectedDate = parseValue(value);
    const effectiveMinDate = minDate ?? new Date();

    return (
      <div className="mb-4" ref={ref}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <DatePicker
          selected={selectedDate}
          onChange={handleChange}
          dateFormat="MM/dd/yyyy"
          placeholderText={placeholder}
          minDate={effectiveMinDate}
          maxDate={maxDate}
          disabled={disabled}
          portalId="root-datepicker"
          popperClassName="stl-datepicker-popper"
          calendarClassName="stl-datepicker"
          popperPlacement="bottom-start"
          popperProps={{ strategy: 'fixed' }}
          showPopperArrow={false}
          onChangeRaw={handleRawChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${className}`}
          {...props}
        />

        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';
export default DateInput;
