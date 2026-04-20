import Input from '../Input';
import NumericInput from '../NumericInput';
import Select from '../Select';
import Textarea from '../Textarea';
import DateInput from '../DateInput';
import { formatNumber, unformatNumber, sanitizePercent } from '../../utils/format';

const FinancialInformationSection = ({
  formData,
  setFormData,
  handleChange,
  errors,
  errorRefs,
  isCreativeFinancing,
}) => {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold mb-4">Financial Information</h2>

      {/* Primary Deal Terms */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Input
          label={
            <span>
              Price <span className="text-accent">($)</span>{' '}
              <span className="text-red-500">*</span>
            </span>
          }
          name="price"
          type="text"
          inputMode="numeric"
          value={formatNumber(formData.price ?? '')}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              price: unformatNumber(e.target.value).replace(
                /[^0-9]/g,
                ''
              ),
            }))
          }
          required
          error={errors.price}
          placeholder="e.g., 500,000"
        />

        <Select
          label="Type of Financing"
          name="financingType"
          value={formData.financingType ?? ''}
          onChange={handleChange}
          required
          options={[
            { value: 'traditional', label: 'Traditional Financing' },
            {
              value: 'subject-to',
              label: 'Creative Financing (Subject-to)',
            },
            { value: 'hybrid', label: 'Creative Financing (Hybrid)' },
            {
              value: 'seller',
              label: 'Creative Financing (Seller Financing)',
            },
            { value: 'cash', label: 'Cash Only' },
          ]}
          error={errors.financingType}
        />

        <DateInput
          label="Expected Close of Escrow"
          name="expectedCloseDate"
          value={formData.expectedCloseDate ?? ''}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              expectedCloseDate: e.target.value,
            }))
          }
          placeholder="Select date"
        />
      </div>

      {/* Transactional Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Earnest Money Deposit (EMD) ($)"
          name="emd"
          type="text"
          inputMode="numeric"
          value={formatNumber(formData.emd ?? '')}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              emd: unformatNumber(e.target.value).replace(
                /[^0-9]/g,
                ''
              ),
            }))
          }
          error={errors.emd}
          ref={(el) => (errorRefs.current.emd = el)}
        />

        <Input
          label="Down Payment (Excluding closing costs) ($)"
          name="downPayment"
          type="text"
          inputMode="numeric"
          value={formatNumber(formData.downPayment ?? '')}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              downPayment: unformatNumber(e.target.value).replace(
                /[^0-9]/g,
                ''
              ),
            }))
          }
          error={errors.downPayment}
          ref={(el) => (errorRefs.current.downPayment = el)}
        />
      </div>

      {/* Additional Financial Info */}
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
        placeholder="Why is the Seller selling this property?"
        ref={(el) => (errorRefs.current.financialInfo = el)}
      />

      {/* Subject-to Loan Information */}
      {isCreativeFinancing && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Subject-to Loan Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <NumericInput
              label={
                <span>
                  Loan Balance <span className="text-accent">($)</span>
                </span>
              }
              name="subjLoanBalance"
              type="text"
              inputMode="numeric"
              value={formatNumber(formData.subjLoanBalance ?? '')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  subjLoanBalance: unformatNumber(
                    e.target.value
                  ).replace(/[^0-9]/g, ''),
                }))
              }
              error={errors.subjLoanBalance}
              ref={(el) => (errorRefs.current.subjLoanBalance = el)}
            />

            <NumericInput
              label="Interest Rate (%)"
              name="subjInterestRate"
              type="text"
              inputMode="decimal"
              value={formData.subjInterestRate ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  subjInterestRate: sanitizePercent(e.target.value),
                }))
              }
              error={errors.subjInterestRate}
              ref={(el) => (errorRefs.current.subjInterestRate = el)}
            />

            <DateInput
              label="Loan Maturity Date"
              name="subjLoanMaturity"
              value={formData.subjLoanMaturity ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  subjLoanMaturity: e.target.value,
                }))
              }
              error={errors.subjLoanMaturity}
              placeholder="Select date"
            />
          </div>

          <Input
            label={
              <span>
                Monthly Principal
                <span className="text-accent"> ($)</span>
              </span>
            }
            name="subjMonthlyPrincipal"
            type="text"
            inputMode="numeric"
            value={formatNumber(formData.subjMonthlyPrincipal ?? '')}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                subjMonthlyPrincipal: unformatNumber(
                  e.target.value
                ).replace(/[^0-9]/g, ''),
              }))
            }
            error={errors.subjMonthlyPrincipal}
            className="w-full"
            ref={(el) => (errorRefs.current.subjMonthlyPrincipal = el)}
          />
          <Input
            label={
              <span>
                Monthly Interest
                <span className="text-accent"> ($)</span>
              </span>
            }
            name="subjMonthlyInterest"
            type="text"
            inputMode="numeric"
            value={formatNumber(formData.subjMonthlyInterest ?? '')}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                subjMonthlyInterest: unformatNumber(
                  e.target.value
                ).replace(/[^0-9]/g, ''),
              }))
            }
            error={errors.subjMonthlyInterest}
            className="w-full"
            ref={(el) => (errorRefs.current.subjMonthlyInterest = el)}
          />
          <Input
            label={
              <span>
                Monthly Taxes and Insurance
                <span className="text-accent"> ($)</span>
              </span>
            }
            name="subjMonthlyTaxesInsurance"
            type="text"
            inputMode="numeric"
            value={formatNumber(
              formData.subjMonthlyTaxesInsurance ?? ''
            )}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                subjMonthlyTaxesInsurance: unformatNumber(
                  e.target.value
                ).replace(/[^0-9]/g, ''),
              }))
            }
            error={errors.subjMonthlyTaxesInsurance}
            className="w-full"
            ref={(el) =>
              (errorRefs.current.subjMonthlyTaxesInsurance = el)
            }
          />
        </div>
      )}

      {/* Seller Financing Information */}
      {isCreativeFinancing && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Seller Financing Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
            <Input
              label={
                <span>
                  Seller Loan Amount{' '}
                  <span className="text-accent">($)</span>
                </span>
              }
              name="sellerLoanAmount"
              type="text"
              inputMode="numeric"
              value={formatNumber(formData.sellerLoanAmount ?? '')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  sellerLoanAmount: unformatNumber(
                    e.target.value
                  ).replace(/[^0-9]/g, ''),
                }))
              }
              error={errors.sellerLoanAmount}
              ref={(el) => (errorRefs.current.sellerLoanAmount = el)}
            />

            <Input
              label="Seller Interest Rate (%)"
              name="sellerInterestRate"
              type="text"
              inputMode="decimal"
              value={formData.sellerInterestRate ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  sellerInterestRate: sanitizePercent(e.target.value),
                }))
              }
              error={errors.sellerInterestRate}
              ref={(el) => (errorRefs.current.sellerInterestRate = el)}
            />

            <DateInput
              label="Loan Maturity Date"
              name="sellerLoanMaturity"
              value={formData.sellerLoanMaturity ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  sellerLoanMaturity: e.target.value,
                }))
              }
              error={errors.sellerLoanMaturity}
              placeholder="Select date"
            />
          </div>

          <Input
            label={
              <span>
                Monthly Seller Financing Payment{' '}
                <span className="text-accent">($)</span>
              </span>
            }
            name="sellerMonthlyPayment"
            type="text"
            inputMode="numeric"
            value={formatNumber(formData.sellerMonthlyPayment ?? '')}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                sellerMonthlyPayment: unformatNumber(
                  e.target.value
                ).replace(/[^0-9]/g, ''),
              }))
            }
            error={errors.sellerMonthlyPayment}
            className="w-full"
            ref={(el) => (errorRefs.current.sellerMonthlyPayment = el)}
          />

          <Input
            label={
              <span className="text-lg font-bold mb-4">
                Total Monthly Payment{' '}
                <span className="text-accent">($)</span>
              </span>
            }
            name="totalMonthlyPayment"
            type="text"
            inputMode="numeric"
            value={formatNumber(formData.totalMonthlyPayment ?? '')}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                totalMonthlyPayment: unformatNumber(
                  e.target.value
                ).replace(/[^0-9]/g, ''),
              }))
            }
            error={errors.totalMonthlyPayment}
            className="w-full font-bold"
            ref={(el) => (errorRefs.current.totalMonthlyPayment = el)}
          />
        </div>
      )}

      {/* HOA Information */}
      <div className="mt-6">
        <Select
          label="Is This Property In An HOA?"
          name="isHOA"
          value={formData.isHOA ? 'yes' : 'no'}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              isHOA: e.target.value === 'yes',
            }))
          }
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ]}
        />

        {formData.isHOA && (
          <div className="mt-3">
            <NumericInput
              label="HOA Monthly Fee ($)"
              name="hoaMonthlyFee"
              type="text"
              inputMode="numeric"
              value={formatNumber(formData.hoaMonthlyFee ?? '')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  hoaMonthlyFee: unformatNumber(e.target.value).replace(
                    /[^0-9]/g,
                    ''
                  ),
                }))
              }
              ref={(el) => (errorRefs.current.hoaMonthlyFee = el)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialInformationSection;
