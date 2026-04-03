/**
 * DuplicateAddressModal Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DuplicateAddressModal from '../components/DuplicateAddressModal';

describe('DuplicateAddressModal', () => {
  const mockExistingProperty = {
    id: 'prop-123',
    streetAddress: '123 Main St',
    city: 'Austin',
    stateRegion: 'TX',
    postalCode: '78701',
    submitterEmail: 'owner@example.com',
    status: 'published',
    submittedAt: '2025-01-15T10:00:00Z',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    existingProperty: mockExistingProperty,
    onClaimOwnership: vi.fn(),
    onProceedWithoutClaim: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(<DuplicateAddressModal {...defaultProps} isOpen={false} />);

    expect(
      screen.queryByText('Duplicate Address Detected')
    ).not.toBeInTheDocument();
  });

  it('should render modal when isOpen is true', () => {
    render(<DuplicateAddressModal {...defaultProps} />);

    expect(screen.getByText('Duplicate Address Detected')).toBeInTheDocument();
  });

  it('should display warning message about duplicate address', () => {
    render(<DuplicateAddressModal {...defaultProps} />);

    expect(
      screen.getByText(/A property at this address already exists/)
    ).toBeInTheDocument();
  });

  it('should display existing property information', () => {
    render(<DuplicateAddressModal {...defaultProps} />);

    expect(screen.getByText('Existing Property')).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText(/Austin/)).toBeInTheDocument();
    expect(screen.getByText('published')).toBeInTheDocument();
  });

  it('should display formatted submission date', () => {
    render(<DuplicateAddressModal {...defaultProps} />);

    // The date should be formatted as "January 15, 2025"
    expect(screen.getByText(/January 15, 2025/)).toBeInTheDocument();
  });

  it('should display "Unknown" for missing date', () => {
    const propsWithoutDate = {
      ...defaultProps,
      existingProperty: {
        ...mockExistingProperty,
        submittedAt: null,
      },
    };
    render(<DuplicateAddressModal {...propsWithoutDate} />);

    expect(screen.getByText(/Unknown/)).toBeInTheDocument();
  });

  it('should display both ownership options', () => {
    render(<DuplicateAddressModal {...defaultProps} />);

    expect(screen.getByText('I own this property')).toBeInTheDocument();
    expect(screen.getByText('I do not own this property')).toBeInTheDocument();
  });

  it('should have Continue button disabled initially', () => {
    render(<DuplicateAddressModal {...defaultProps} />);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeDisabled();
  });

  it('should enable Continue button when an option is selected', async () => {
    const user = userEvent.setup();
    render(<DuplicateAddressModal {...defaultProps} />);

    const claimOption = screen.getByRole('radio', {
      name: /I own this property/i,
    });
    await user.click(claimOption);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).not.toBeDisabled();
  });

  it('should call onClaimOwnership when claim option is selected and Continue clicked', async () => {
    const user = userEvent.setup();
    render(<DuplicateAddressModal {...defaultProps} />);

    const claimOption = screen.getByRole('radio', {
      name: /I own this property/i,
    });
    await user.click(claimOption);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    await user.click(continueButton);

    expect(defaultProps.onClaimOwnership).toHaveBeenCalledTimes(1);
    expect(defaultProps.onProceedWithoutClaim).not.toHaveBeenCalled();
  });

  it('should call onProceedWithoutClaim when no-claim option is selected and Continue clicked', async () => {
    const user = userEvent.setup();
    render(<DuplicateAddressModal {...defaultProps} />);

    const noClaimOption = screen.getByRole('radio', {
      name: /I do not own this property/i,
    });
    await user.click(noClaimOption);

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    await user.click(continueButton);

    expect(defaultProps.onProceedWithoutClaim).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClaimOwnership).not.toHaveBeenCalled();
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<DuplicateAddressModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should display loading state when isLoading is true', () => {
    render(<DuplicateAddressModal {...defaultProps} isLoading={true} />);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should disable buttons when isLoading is true', async () => {
    const user = userEvent.setup();
    render(<DuplicateAddressModal {...defaultProps} isLoading={true} />);

    // Select an option first
    const claimOption = screen.getByRole('radio', {
      name: /I own this property/i,
    });
    await user.click(claimOption);

    const continueButton = screen.getByRole('button', {
      name: 'Processing...',
    });
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });

    expect(continueButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('should display correct status badge colors', () => {
    const statuses = [
      { status: 'published', expectedClass: 'bg-green-100' },
      { status: 'approved', expectedClass: 'bg-blue-100' },
      { status: 'pending', expectedClass: 'bg-yellow-100' },
      { status: 'other', expectedClass: 'bg-gray-100' },
    ];

    statuses.forEach(({ status, expectedClass }) => {
      const { unmount } = render(
        <DuplicateAddressModal
          {...defaultProps}
          existingProperty={{ ...mockExistingProperty, status }}
        />
      );

      const statusBadge = screen.getByText(status);
      expect(statusBadge.className).toContain(expectedClass);

      unmount();
    });
  });

  it('should display warning about properties being unpublished during review', () => {
    render(<DuplicateAddressModal {...defaultProps} />);

    expect(
      screen.getByText(/Both properties will be temporarily unpublished/)
    ).toBeInTheDocument();
  });

  it('should handle missing existingProperty gracefully', () => {
    render(<DuplicateAddressModal {...defaultProps} existingProperty={null} />);

    // Modal should still render without crashing
    expect(screen.getByText('Duplicate Address Detected')).toBeInTheDocument();
    // But existing property section should not be visible
    expect(screen.queryByText('Existing Property')).not.toBeInTheDocument();
  });

  it('should allow switching between options', async () => {
    const user = userEvent.setup();
    render(<DuplicateAddressModal {...defaultProps} />);

    const claimOption = screen.getByRole('radio', {
      name: /I own this property/i,
    });
    const noClaimOption = screen.getByRole('radio', {
      name: /I do not own this property/i,
    });

    // Select claim first
    await user.click(claimOption);
    expect(claimOption).toBeChecked();
    expect(noClaimOption).not.toBeChecked();

    // Switch to no-claim
    await user.click(noClaimOption);
    expect(noClaimOption).toBeChecked();
    expect(claimOption).not.toBeChecked();
  });
});
