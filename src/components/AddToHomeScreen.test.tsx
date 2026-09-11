import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AddToHomeScreen } from './AddToHomeScreen';

describe('AddToHomeScreen component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders accessible prompt dialog when beforeinstallprompt event is dispatched', () => {
    render(<AddToHomeScreen />);

    const mockEvent = new Event('beforeinstallprompt') as any;
    mockEvent.preventDefault = vi.fn();
    mockEvent.prompt = vi.fn();
    mockEvent.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });

    act(() => {
      window.dispatchEvent(mockEvent);
      vi.advanceTimersByTime(3000);
    });

    const dialog = screen.getByRole('dialog', { name: 'Install App Prompt' });
    expect(dialog).toBeInTheDocument();

    const installBtn = screen.getByRole('button', { name: /install now/i });
    expect(installBtn).toBeInTheDocument();

    const laterBtn = screen.getByRole('button', { name: /later/i });
    expect(laterBtn).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss app install prompt' });
    expect(dismissBtn).toBeInTheDocument();
  });
});
