import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import CRM from './CRM';

// Mock the context and firebase
vi.mock('../contexts/TenantContext', () => ({
  useTenant: () => ({ tenant: { id: 'test-tenant' } }),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => React.createRef(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn().mockImplementation((q, cb) => {
    cb({ docs: [] });
    return vi.fn();
  }),
  query: vi.fn(),
  where: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { uid: 'test-user' } },
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { CREATE: 'CREATE', UPDATE: 'UPDATE', LIST: 'LIST' },
  logSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: class { addScope() {} static credentialFromResult() { return { accessToken: 'token' } } },
}));

vi.mock('../services/brainService', () => ({
  ingestKnowledge: vi.fn(),
  fetchRelevantMemory: vi.fn().mockResolvedValue([]),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: () => <div>AreaChart</div>,
  Area: () => <div>Area</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  Tooltip: () => <div>Tooltip</div>,
  CartesianGrid: () => <div>CartesianGrid</div>,
}));

describe('CRM Component Edge Case & Boundary Testing', () => {
    const renderCRM = () => render(
        <BrowserRouter>
            <CRM />
        </BrowserRouter>
    );

    it('should mount correctly and show New Client button', () => {
        renderCRM();
        expect(screen.getByText('New Client')).toBeInTheDocument();
    });

    it('should open Add Modal and allow fuzzing inputs with emoji and long strings', async () => {
        renderCRM();
        const newClientBtn = screen.getByText('New Client');
        fireEvent.click(newClientBtn);

        // Wait for modal to render
        await waitFor(() => {
            expect(screen.getByText('Onboard Client')).toBeInTheDocument();
        });

        // Test fuzzing inputs
        const firstNameInput = screen.getByLabelText(/First Name/i);
        fireEvent.change(firstNameInput, { target: { value: '😂👌🔥 A very long string'.repeat(20) } });
        expect(firstNameInput).toHaveValue('😂👌🔥 A very long string'.repeat(20));

        const addressInput = screen.getByLabelText(/Service Address/i);
        fireEvent.change(addressInput, { target: { value: 'DROP TABLE customers;-- <script>alert(1)</script>' } });
        expect(addressInput).toHaveValue('DROP TABLE customers;-- <script>alert(1)</script>');
    });
});
