/**
 * Upload Progress Bar Component Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UploadProgressBar from '../components/UploadProgressBar';

describe('UploadProgressBar', () => {
  describe('visibility', () => {
    it('should not render when isVisible is false', () => {
      const { container } = render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={2}
          total={5}
          isVisible={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should not render when stage is null', () => {
      const { container } = render(
        <UploadProgressBar
          stage={null}
          completed={0}
          total={0}
          isVisible={true}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when isVisible is true and stage is set', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={2}
          total={5}
          isVisible={true}
        />
      );

      expect(screen.getByText('Uploading Files')).toBeInTheDocument();
    });
  });

  describe('content display', () => {
    it('should display the stage label', () => {
      render(
        <UploadProgressBar
          stage="Exterior Photos"
          completed={1}
          total={3}
          isVisible={true}
        />
      );

      expect(screen.getByText('Exterior Photos')).toBeInTheDocument();
    });

    it('should display file count progress', () => {
      render(
        <UploadProgressBar
          stage="Videos"
          completed={2}
          total={5}
          isVisible={true}
        />
      );

      expect(screen.getByText('2 of 5 files')).toBeInTheDocument();
    });

    it('should display percentage complete', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={2}
          total={4}
          currentFileProgress={0}
          isVisible={true}
        />
      );

      // 2/4 = 50%
      expect(screen.getByText('50% complete')).toBeInTheDocument();
    });

    it('should display warning message', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={0}
          total={1}
          isVisible={true}
        />
      );

      expect(screen.getByText(/Do not close this window/)).toBeInTheDocument();
    });
  });

  describe('progress calculation', () => {
    it('should calculate correct percentage with no current file progress', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={3}
          total={6}
          currentFileProgress={0}
          isVisible={true}
        />
      );

      // 3/6 = 50%
      expect(screen.getByText('50% complete')).toBeInTheDocument();
    });

    it('should show 0% when no files completed', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={0}
          total={5}
          currentFileProgress={0}
          isVisible={true}
        />
      );

      expect(screen.getByText('0% complete')).toBeInTheDocument();
    });

    it('should show 100% when all files completed', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={5}
          total={5}
          currentFileProgress={100}
          isVisible={true}
        />
      );

      expect(screen.getByText('100% complete')).toBeInTheDocument();
    });
  });

  describe('current file progress indicator', () => {
    it('should show current file progress when uploading', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={1}
          total={3}
          currentFileProgress={50}
          isVisible={true}
        />
      );

      expect(screen.getByText('Current file')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should not show current file progress at 0%', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={1}
          total={3}
          currentFileProgress={0}
          isVisible={true}
        />
      );

      expect(screen.queryByText('Current file')).not.toBeInTheDocument();
    });

    it('should not show current file progress at 100%', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={2}
          total={3}
          currentFileProgress={100}
          isVisible={true}
        />
      );

      expect(screen.queryByText('Current file')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <UploadProgressBar
          stage="Interior Photos"
          completed={0}
          total={1}
          isVisible={true}
        />
      );

      const heading = screen.getByRole('heading', { level: 3, hidden: true });
      expect(
        heading || screen.getByText('Uploading Files')
      ).toBeInTheDocument();
    });
  });
});
