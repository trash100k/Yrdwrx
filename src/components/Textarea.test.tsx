import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Textarea } from './Textarea';

describe('Textarea accessibility', () => {
  it('renders with label and connects htmlFor with textarea id', () => {
    render(<Textarea label="Notes" id="notes-textarea" />);
    const textarea = screen.getByRole('textbox', { name: 'Notes' });
    expect(textarea).toBeDefined();
    expect(textarea.getAttribute('id')).toBe('notes-textarea');
  });

  it('sets aria-invalid and aria-describedby when error is provided', () => {
    render(<Textarea label="Comments" id="comments-input" error="Comment is required" />);
    const textarea = screen.getByRole('textbox', { name: 'Comments' });
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.getAttribute('aria-describedby')).toBe('comments-input-error');

    const errorMessage = screen.getByText('Comment is required');
    expect(errorMessage.getAttribute('id')).toBe('comments-input-error');
  });

  it('sets aria-describedby to helpText when no error is present', () => {
    render(<Textarea label="Feedback" id="feedback-input" helpText="Max 500 characters" />);
    const textarea = screen.getByRole('textbox', { name: 'Feedback' });
    expect(textarea.getAttribute('aria-invalid')).toBe('false');
    expect(textarea.getAttribute('aria-describedby')).toBe('feedback-input-help');

    const helpText = screen.getByText('Max 500 characters');
    expect(helpText.getAttribute('id')).toBe('feedback-input-help');
  });
});
