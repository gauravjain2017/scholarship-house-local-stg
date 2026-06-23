import Input from '../Input';
import Select from '../Select';
import Textarea from '../Textarea';
import DateInput from '../DateInput';
import { formatNumber, unformatNumber, sanitizePercent } from '../../utils/format';

const BALLOON_YEARS = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  return { value: `${n}`, label: `${n} Year${n > 1 ? 's' : ''}` };
});

const FinancialInformationSection = ({
  formData,
  setFormData,
  handleChange,
  errors,
  errorRefs,
  isCreativeFinancing,
}) => {
  // ── Render helpers (JSX factories that close over formData/setFormData) ──
  const setField = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const moneyField = (name, label) => (
    <Input
      label={label}
      name={name}
      type="text"
      inputMode="numeric"
      value={formatNumber(formData[name] ?? '')}
      onChange={(e) =>
        setField(name, unformatNumber(e.target.value).replace(/[^0-9]/g, ''))
      }
      error={errors[name]}
      ref={(el) => (errorRefs.current[name] = el)}
    />
  );

  const percentField = (name, label) => (
    <Input
      label={label}
      name={name}
      type="text"
      inputMode="decimal"
      value={formData[name] ?? ''}
      onChange={(e) => setField(name, sanitizePercent(e.target.value))}
      error={errors[name]}
      ref={(el) => (errorRefs.current[name] = el)}
    />
  );

  const dateField = (name, label) => (
    <DateInput
      label={label}
      name={name}
      value={formData[name] ?? ''}
      onChange={(e) => setField(name, e.target.value)}
      error={errors[name]}
      placeholder="Select date"
    />
  );

  const yesNo = (name, label) => (
    <div className="mb-4">
      <label className="block text-base md:text-lg font-semibold text-text-primary mb-2">
        {label}
      </label>
      <div className="flex items-center gap-6">
        {[
          ['yes', 'Yes'],
          ['no', 'No'],
        ].map(([val, lbl]) => (
          <label key={val} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={val}
              checked={formData[name] === val}
              onChange={() => setField(name, val)}
              className="h-4 w-4 text-accent focus:ring-accent"
            />
            <span className="text-sm text-text-primary">{lbl}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold mb-4">Financial Information</h2>

      {/* Type of Financing — FIRST */}
      <Select
        label={
          <span className="text-base md:text-lg font-semibold">
            Type of Financing
          </span>
        }
        name="financingType"
        value={formData.financingType ?? ''}
        onChange={handleChange}
        required
        options={[
          { value: 'traditional', label: 'Traditional Financing' },
          { value: 'creative', label: 'Creative Financing' },
        ]}
        error={errors.financingType}
      />

      {/* Purchase Price — SECOND */}
      <Input
        label={
          <span className="text-base md:text-lg font-semibold">
            Purchase Price <span className="text-accent">($)</span>{' '}
            <span className="text-red-500">*</span>
          </span>
        }
        name="price"
        type="text"
        inputMode="numeric"
        value={formatNumber(formData.price ?? '')}
        onChange={(e) =>
          setField('price', unformatNumber(e.target.value).replace(/[^0-9]/g, ''))
        }
        required
        error={errors.price}
        placeholder="e.g., 500,000"
        className="w-full mt-4"
      />

      {/* TRADITIONAL: Additional Financial Information only */}
      {!isCreativeFinancing && (
        <div className="mt-6">
          <Textarea
            label={
              <span className="text-base md:text-lg font-semibold">
                Additional Financial Information
              </span>
            }
            name="financialInfo"
            value={formData.financialInfo ?? ''}
            onChange={handleChange}
            error={errors.financialInfo}
            rows={6}
            placeholder="Include any relevant financial details, notes, or context about this transaction..."
            ref={(el) => (errorRefs.current.financialInfo = el)}
          />
        </div>
      )}

      {/* CREATIVE: Full conditional flow */}
      {isCreativeFinancing && (
        <div className="mt-6">
          {/* Expected Close of Escrow + EMD + Down Payment + Assignment Fee */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dateField('expectedCloseDate', 'Expected Close of Escrow')}
            {moneyField('emd', 'Earnest Money Deposit (EMD) ($)')}
            {moneyField('downPayment', 'Down Payment (Excluding closing costs) ($)')}
            {moneyField('assignmentFee', 'Assignment Fee ($)')}
          </div>

          <hr className="my-8 border-border" />

          {/* PRIMARY MORTGAGE */}
          {yesNo('hasPrimaryMortgage', 'Is There a Primary Mortgage?')} 
          {formData.hasPrimaryMortgage === 'yes' && (
            <div className="border border-border rounded-lg p-4 mb-4">
              <p className="text-base font-semibold text-text-primary mb-4">
                Primary Mortgage Details
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                {moneyField('primaryLoanBalance', 'Loan Balance ($)')}
                {percentField('primaryInterestRate', 'Interest Rate (%)')}
                {dateField('primaryMaturityDate', 'Maturity Date')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {moneyField(
                  'primaryPrincipalInterest',
                  'Combined Principal & Interest ($)'
                )}
                {moneyField('primaryTaxesInsurance', 'Taxes & Insurance ($)')}
              </div>
            </div>
          )}

          <hr className="my-8 border-border" />

          {/* SECOND MORTGAGE */}
          {yesNo('hasSecondMortgage', 'Is There a Second Mortgage?')}
          {formData.hasSecondMortgage === 'yes' && (
            <div className="border border-border rounded-lg p-4 mb-4">
              <p className="text-base font-semibold text-text-primary mb-4">
                Second Mortgage Details
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                {moneyField('secondLoanBalance', 'Loan Balance ($)')}
                {percentField('secondInterestRate', 'Interest Rate (%)')}
                {dateField('secondMaturityDate', 'Maturity Date')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {moneyField(
                  'secondPrincipalInterest',
                  'Combined Principal & Interest ($)'
                )}
                {moneyField('secondTaxesInsurance', 'Taxes & Insurance ($)')}
              </div>
            </div>
          )}

          <hr className="my-8 border-border" />

          {/* SELLER EQUITY */}
          {yesNo('hasSellerEquity', 'Is There Any Seller Equity?')}
          {formData.hasSellerEquity === 'yes' && (
            <div className="border border-border rounded-lg p-4 mb-4">
              <p className="text-base font-semibold text-text-primary mb-4">
                Seller Equity Details
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                {moneyField('sellerEquityAmount', 'Seller Loan Amount ($)')}
                {percentField('sellerEquityInterestRate', 'Interest Rate (%)')}
                {dateField('sellerEquityMaturityDate', 'Maturity Date')}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {moneyField(
                  'sellerEquityPrincipalInterest',
                  'Combined Principal & Interest ($)'
                )}
                <Select
                  label="When Is the Balloon Payment Due?"
                  name="sellerEquityBalloonYears"
                  value={formData.sellerEquityBalloonYears ?? ''}
                  onChange={handleChange}
                  options={BALLOON_YEARS}
                  error={errors.sellerEquityBalloonYears}
                />
              </div>
            </div>
          )}

          <hr className="my-8 border-border" />

          {/* Deal Terms (creative only) */}
          <Textarea
            label={
              <span className="text-base md:text-lg font-semibold">
                Deal Terms
              </span>
            }
            name="dealTerms"
            value={formData.dealTerms ?? ''}
            onChange={handleChange}
            error={errors.dealTerms}
            rows={6}
            placeholder="Describe the deal terms, financing details, and any nuances of this transaction."
            ref={(el) => (errorRefs.current.dealTerms = el)}
          />

          {/* Total Starting Monthly Payment — displayed below Deal Terms */}
          <div className="mt-6">
            {moneyField(
              'totalStartingMonthlyPayment',
              <span className="text-base md:text-lg font-semibold">
                Total Starting Monthly Payment ($)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialInformationSection;
