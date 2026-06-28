// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { isPrivateIP } from './lib/securityUtils';

// NOTE: We intentionally do NOT import/render <App/> here — App pulls in Firebase,
// React Router, and many lazy routes that need a browser/auth environment. This file
// exercises (a) the render pipeline via a trivial pure presentational component and
// (b) a pure utility, so it stays fast, deterministic, and offline-safe.

function Badge({ label }: { label: string }) {
  return <span data-testid="badge">{label}</span>;
}

describe('App test harness (sanity)', () => {
  it('renders a trivial pure presentational component', () => {
    render(<Badge label="YardWorx" />);
    expect(screen.getByTestId('badge')).toHaveTextContent('YardWorx');
  });

  it('exercises a pure utility from the app code (isPrivateIP)', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('8.8.8.8')).toBe(false);
  });
});
