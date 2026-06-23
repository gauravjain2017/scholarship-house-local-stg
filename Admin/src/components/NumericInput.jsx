import React, { forwardRef } from 'react';
import Input from './Input';

const NumericInput = forwardRef((props, ref) => {
  const allowNumericOnly = (e) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
    ];
    if (allowedKeys.includes(e.key)) return;
    if (/^[0-9]$/.test(e.key)) return;
    if (e.key === '.' && !e.currentTarget.value.includes('.')) return;
    e.preventDefault();
  };

  const handleNumericPaste = (e) => {
    e.preventDefault();
    let text = e.clipboardData.getData('text');
    // Remove all but digits and first "."
    let sanitized = text.replace(/[^0-9.]/g, '');
    const firstDot = sanitized.indexOf('.');
    if (firstDot !== -1) {
      sanitized =
        sanitized.slice(0, firstDot + 1) +
        sanitized.slice(firstDot + 1).replace(/\./g, '');
    }
    const { name, onChange } = props;
    if (onChange) {
      // Simulate a normal event for onChange
      onChange({
        target: {
          name,
          value: sanitized,
        },
      });
    }
  };

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      onKeyDown={allowNumericOnly}
      onPaste={handleNumericPaste}
      onWheel={(e) => e.target.blur()}
    />
  );
});

export default NumericInput;
