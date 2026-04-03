const STEPS = [
  { number: 1, label: 'Property' },
  { number: 2, label: 'Location' },
  { number: 3, label: 'Financial' },
  { number: 4, label: 'Rental Data' },
  { number: 5, label: 'Photos' },
  { number: 6, label: 'Review' },
];

const StepIndicator = ({ currentStep, onStepClick, completedSteps = [] }) => {
  return (
    <div className="w-full mb-8" style={{ width: '65%', marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Circles + connector lines row */}
      <div className="flex items-center">
        {STEPS.map((step, index) => {
          const isActive = currentStep === step.number;
          const isCompleted = completedSteps.includes(step.number);
          const isClickable = isCompleted || step.number <= currentStep;

          return (
            <div key={step.number} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.number)}
                disabled={!isClickable}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-200 border-2 shrink-0
                  ${isActive
                    ? 'bg-accent text-white border-accent shadow-md shadow-accent/30'
                    : isCompleted
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface text-text-secondary border-border-subtle'
                  }
                  ${isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-not-allowed'}
                `}
              >
                {isCompleted && !isActive ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </button>

              {/* Connector line between circles */}
              {index < STEPS.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2
                    ${isCompleted ? 'bg-accent' : 'bg-surface-alt'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Labels row */}
      <div className="flex justify-between mt-2">
        {STEPS.map((step) => {
          const isActive = currentStep === step.number;
          const isCompleted = completedSteps.includes(step.number);

          return (
            <span
              key={step.number}
              className={`
                text-xs font-medium text-center w-10
                ${isActive || isCompleted ? 'text-accent' : 'text-text-secondary'}
              `}
            >
              {step.label}
            </span>
          );
        })}
      </div>

      {/* Progress bar */}
      {/* <div className="mt-4 w-full bg-surface-alt rounded-full h-1">
        <div
          className="bg-accent h-1 rounded-full transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div> */}
    </div>
  );
};

export { STEPS };
export default StepIndicator;
