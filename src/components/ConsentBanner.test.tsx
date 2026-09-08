import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ConsentBanner } from './ConsentBanner';
import { safeStorage } from '../lib/storage';

describe('ConsentBanner', () => {
  beforeEach(() => {
    try {
      safeStorage.removeItem('cutty_data_consent');
    } catch {}
  });

  it('renders with ARIA region role and descriptive aria-label', () => {
    render(<ConsentBanner />);
    const region = screen.getByRole('region', { name: /data privacy and cookies/i });
    expect(region).toBeInTheDocument();
  });

  it('renders dismiss button with explicit aria-label', () => {
    render(<ConsentBanner />);
    const dismissButton = screen.getByRole('button', { name: /dismiss cookie banner/i });
    expect(dismissButton).toBeInTheDocument();
  });

  it('dismisses banner when close button is clicked', () => {
    render(<ConsentBanner />);
    const dismissButton = screen.getByRole('button', { name: /dismiss cookie banner/i });
    fireEvent.click(dismissButton);
    expect(screen.queryByRole('region', { name: /data privacy and cookies/i })).not.toBeInTheDocument();
  });
});
