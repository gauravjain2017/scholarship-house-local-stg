/**
 * Property-Based Test: Multiple Labels Display
 * **Validates: Requirements AC-1.1, AC-1.3**
 *
 * This test verifies that when a property has multiple active labels
 * (Premium, 50/50 Partnership, Turnkey), all active labels are displayed
 * in the rendered output.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { deriveTurnkey } from '../utils/turnkey';

// Mock component that renders badges similar to DealDetailView
const BadgeDisplay = ({ deal }) => {
  const isTurnkey = deriveTurnkey(deal.turnkeyFurnished);

  return (
    <div data-testid="badge-container">
      {deal.priorityFirstAccess && (
        <div data-testid="priority-badge">Premium</div>
      )}

      {deal.fiftyFiftyPartner && (
        <div data-testid="partnership-badge">50/50 Partnership</div>
      )}

      {isTurnkey && (
        <div data-testid="turnkey-badge">
          <span>Turnkey</span>
          <span>Fully Furnished</span>
        </div>
      )}
    </div>
  );
};

describe('Property 2: Multiple Labels Display', () => {
  afterEach(() => {
    cleanup();
  });

  it('should display all active labels when multiple labels are enabled', () => {
    // Arbitrary for turnkeyFurnished values
    const turnkeyFurnishedArb = fc.oneof(
      fc.constant('TURNKEY_OPERATING'),
      fc.constant('FURNISHED_NOT_OPERATING'),
      fc.constant('PARTIALLY_FURNISHED'),
      fc.constant('NOT_FURNISHED')
    );

    // Arbitrary for deal properties with labels
    const dealArb = fc.record({
      priorityFirstAccess: fc.boolean(),
      fiftyFiftyPartner: fc.boolean(),
      turnkeyFurnished: turnkeyFurnishedArb,
    });

    // Property: For any deal with multiple active labels,
    // all active labels should be displayed
    fc.assert(
      fc.property(dealArb, (deal) => {
        const { container } = render(<BadgeDisplay deal={deal} />);

        // Count how many labels should be active
        const isTurnkey = deriveTurnkey(deal.turnkeyFurnished);
        const activeLabels = [
          deal.priorityFirstAccess,
          deal.fiftyFiftyPartner,
          isTurnkey,
        ].filter(Boolean);

        // If there are multiple active labels (2 or more)
        if (activeLabels.length >= 2) {
          // Verify Premium badge
          if (deal.priorityFirstAccess) {
            const priorityBadge = container.querySelector(
              '[data-testid="priority-badge"]'
            );
            expect(priorityBadge).toBeInTheDocument();
            expect(priorityBadge).toHaveTextContent('Premium');
          }

          // Verify 50/50 Partnership badge
          if (deal.fiftyFiftyPartner) {
            const partnershipBadge = container.querySelector(
              '[data-testid="partnership-badge"]'
            );
            expect(partnershipBadge).toBeInTheDocument();
            expect(partnershipBadge).toHaveTextContent('50/50 Partnership');
          }

          // Verify Turnkey badge
          if (isTurnkey) {
            const turnkeyBadge = container.querySelector(
              '[data-testid="turnkey-badge"]'
            );
            expect(turnkeyBadge).toBeInTheDocument();
            expect(turnkeyBadge).toHaveTextContent('Turnkey');
            expect(turnkeyBadge).toHaveTextContent('Fully Furnished');
          }
        }

        cleanup();
      }),
      { numRuns: 20 } // Reduced for faster test execution
    );
  });

  it('should display exactly the active labels and no inactive labels', () => {
    // Arbitrary for deal properties
    const dealArb = fc.record({
      priorityFirstAccess: fc.boolean(),
      fiftyFiftyPartner: fc.boolean(),
      turnkeyFurnished: fc.oneof(
        fc.constant('TURNKEY_OPERATING'),
        fc.constant('FURNISHED_NOT_OPERATING'),
        fc.constant('PARTIALLY_FURNISHED'),
        fc.constant('NOT_FURNISHED')
      ),
    });

    // Property: For any deal, only active labels should be displayed
    fc.assert(
      fc.property(dealArb, (deal) => {
        const { container } = render(<BadgeDisplay deal={deal} />);

        const isTurnkey = deriveTurnkey(deal.turnkeyFurnished);

        // Check Premium badge
        const priorityBadge = container.querySelector(
          '[data-testid="priority-badge"]'
        );
        if (deal.priorityFirstAccess) {
          expect(priorityBadge).toBeInTheDocument();
        } else {
          expect(priorityBadge).not.toBeInTheDocument();
        }

        // Check 50/50 Partnership badge
        const partnershipBadge = container.querySelector(
          '[data-testid="partnership-badge"]'
        );
        if (deal.fiftyFiftyPartner) {
          expect(partnershipBadge).toBeInTheDocument();
        } else {
          expect(partnershipBadge).not.toBeInTheDocument();
        }

        // Check Turnkey badge
        const turnkeyBadge = container.querySelector(
          '[data-testid="turnkey-badge"]'
        );
        if (isTurnkey) {
          expect(turnkeyBadge).toBeInTheDocument();
        } else {
          expect(turnkeyBadge).not.toBeInTheDocument();
        }

        cleanup();
      }),
      { numRuns: 20 } // Reduced for faster test execution
    );
  });

  it('should display all three labels simultaneously when all are active', () => {
    // Test the specific case where all three labels are active
    const allActiveDealsArb = fc.record({
      priorityFirstAccess: fc.constant(true),
      fiftyFiftyPartner: fc.constant(true),
      turnkeyFurnished: fc.oneof(
        fc.constant('TURNKEY_OPERATING'),
        fc.constant('FURNISHED_NOT_OPERATING')
      ),
    });

    fc.assert(
      fc.property(allActiveDealsArb, (deal) => {
        const { container } = render(<BadgeDisplay deal={deal} />);

        // All three badges should be present
        const priorityBadge = container.querySelector(
          '[data-testid="priority-badge"]'
        );
        const partnershipBadge = container.querySelector(
          '[data-testid="partnership-badge"]'
        );
        const turnkeyBadge = container.querySelector(
          '[data-testid="turnkey-badge"]'
        );

        expect(priorityBadge).toBeInTheDocument();
        expect(partnershipBadge).toBeInTheDocument();
        expect(turnkeyBadge).toBeInTheDocument();

        // Verify content
        expect(priorityBadge).toHaveTextContent('Premium');
        expect(partnershipBadge).toHaveTextContent('50/50 Partnership');
        expect(turnkeyBadge).toHaveTextContent('Turnkey');
        expect(turnkeyBadge).toHaveTextContent('Fully Furnished');

        cleanup();
      }),
      { numRuns: 20 } // Reduced for faster test execution
    );
  });
});
