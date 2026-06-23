import { forwardRef, useState, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parse, format, isValid } from 'date-fns';

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
    const [inputText, setInputText] = useState(value || '');
    const [isOpen, setIsOpen] = useState(false);
    const datePickerRef = useRef(null);

    const parseValue = (val) => {
      if (!val) return null;
      const formats = ['MM/dd/yyyy', 'M/d/yyyy', 'MM-dd-yyyy', 'yyyy-MM-dd'];
      for (const fmt of formats) {
        const parsed = parse(val, fmt, new Date());
        if (isValid(parsed)) return parsed;
      }
      const iso = new Date(val);
      return isValid(iso) ? iso : null;
    };

    // Sync inputText when value changes externally
    if (value !== undefined && value !== inputText && !isOpen) {
      setInputText(value || '');
    }

    const fireChange = (val) => {
      onChange?.({ target: { name, value: val } });
    };

    // Called when user picks from calendar
    const handleCalendarSelect = (date) => {
      if (!date) {
        setInputText('');
        fireChange('');
        return;
      }
      const formatted = format(date, 'MM/dd/yyyy');
      setInputText(formatted);
      fireChange(formatted);
      setIsOpen(false);
    };

    // Called on every keystroke in text input
    const handleTextChange = (e) => {
      const raw = e.target.value;
      setInputText(raw);

      const parsed = parseValue(raw);
      if (parsed) {
        fireChange(format(parsed, 'MM/dd/yyyy'));
      } else {
        fireChange('');
      }
    };

    const handleBlur = (e) => {
      // If input is invalid on blur, clear it
      const parsed = parseValue(inputText);
      if (!parsed && inputText) {
        setInputText('');
        fireChange('');
      }
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

        <div className="relative">
          {/* Visible text input the user types into */}
          <input
            type="text"
            value={inputText}
            onChange={handleTextChange}
            onBlur={handleBlur}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-light ${
              error ? 'border-red-500' : 'border-gray-300'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${className}`}
          />

          {/* Hidden DatePicker just for the calendar popup */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <DatePicker
              ref={datePickerRef}
              selected={selectedDate}
              onChange={handleCalendarSelect}
              open={isOpen}
              onClickOutside={() => setIsOpen(false)}
              dateFormat="MM/dd/yyyy"
              minDate={effectiveMinDate}
              maxDate={maxDate}
              disabled={disabled}
              portalId="root-datepicker"
              popperClassName="stl-datepicker-popper"
              calendarClassName="stl-datepicker"
              popperPlacement="bottom-start"
              popperProps={{ strategy: 'fixed' }}
              showPopperArrow={false}
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              scrollableYearDropdown
              yearDropdownItemNumber={10}
              customInput={
                <button
                  type="button"
                  onClick={() => setIsOpen((prev) => !prev)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {/* Calendar icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              }
              {...props}
            />
          </div>
        </div>

        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';
export default DateInput;