import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleFirestoreError, OperationType, auth, logSystemEvent } from './firebase';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      uid: 'test-user-123',
      emailVerified: true,
    },
  })),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
  serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
}));

vi.mock('../services/syncService', () => ({
  syncService: {
    queueAction: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock console.error
const originalConsoleError = console.error;

describe('handleFirestoreError', () => {
  let consoleErrorMock: any;

  beforeEach(() => {
    consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    // We can also spy on global fetch or navigator.onLine if needed, but for now we'll just test the core logic
    // of handleFirestoreError.
    // handleFirestoreError calls logSystemEvent. logSystemEvent checks navigator.onLine.
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should format an Error object correctly and log to console', () => {
    const error = new Error('Database connection failed');
    handleFirestoreError(error, OperationType.GET, '/users/123');

    expect(consoleErrorMock).toHaveBeenCalledTimes(1);

    // Check if it was called with the correct prefix
    expect(consoleErrorMock.mock.calls[0][0]).toBe('[STRAT-OS FIREBASE ERROR]');

    // Parse the JSON string passed to console.error
    const loggedJson = JSON.parse(consoleErrorMock.mock.calls[0][1]);

    expect(loggedJson).toEqual({
      error: 'Database connection failed',
      authInfo: {
        userId: 'test-user-123',
        emailVerified: true,
      },
      operationType: 'get',
      path: '/users/123',
    });
  });

  it('should format a string error correctly', () => {
    const errorString = 'Just a string error';
    handleFirestoreError(errorString, OperationType.WRITE, null);

    const loggedJson = JSON.parse(consoleErrorMock.mock.calls[0][1]);

    expect(loggedJson.error).toBe('Just a string error');
    expect(loggedJson.operationType).toBe('write');
    expect(loggedJson.path).toBeNull();
  });

  it('should handle missing auth user', () => {
    // Change the auth mock to simulate no logged in user
    const originalCurrentUser = auth.currentUser;
    // @ts-ignore
    auth.currentUser = null;

    const error = new Error('Test error');
    handleFirestoreError(error, OperationType.LIST, '/items');

    const loggedJson = JSON.parse(consoleErrorMock.mock.calls[0][1]);

    expect(loggedJson.authInfo).toEqual({
      userId: undefined,
      emailVerified: undefined
    });

    // @ts-ignore
    auth.currentUser = originalCurrentUser;
  });

  it('should log to system event if error is not a permission error', async () => {
    // We'll mock logSystemEvent by spying on addDoc since handleFirestoreError calls logSystemEvent directly
    // and logSystemEvent calls addDoc
    const { addDoc } = await import('firebase/firestore');
    const addDocMock = vi.mocked(addDoc);
    addDocMock.mockClear();

    const error = new Error('Network error');

    // Call the function
    handleFirestoreError(error, OperationType.UPDATE, '/posts/1');

    // logSystemEvent is async, so we might need to wait for it.
    // However, handleFirestoreError doesn't await logSystemEvent.
    // It does `.catch(() => {})`. We can use a short timeout or nextTick.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const addedDoc = addDocMock.mock.calls[0][1];

    expect(addedDoc).toMatchObject({
      event: 'ERROR_CAPTURE',
      userId: 'test-user-123',
      metadata: {
        operationType: 'update',
        path: '/posts/1',
        error: 'Network error',
      }
    });
  });

  it('should skip system event logging if error message includes "permission" (case insensitive)', async () => {
    const { addDoc } = await import('firebase/firestore');
    const addDocMock = vi.mocked(addDoc);
    addDocMock.mockClear();

    const error = new Error('Missing or insufficient PERMISSIONs.');

    handleFirestoreError(error, OperationType.DELETE, '/secrets/1');

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('should queue action to syncService when offline', async () => {
    // Set navigator.onLine to false
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      writable: true,
    });

    // Import syncService to assert against it
    const { syncService } = await import('../services/syncService');
    const queueActionMock = vi.mocked(syncService.queueAction);
    queueActionMock.mockClear();

    const error = new Error('Offline error');
    handleFirestoreError(error, OperationType.WRITE, '/local/1');

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(queueActionMock).toHaveBeenCalledTimes(1);
    expect(queueActionMock.mock.calls[0][0]).toBe('CREATE');
    expect(queueActionMock.mock.calls[0][1]).toBe('systemLogs');
    expect(queueActionMock.mock.calls[0][2]).toMatchObject({
      event: 'ERROR_CAPTURE',
      userId: 'test-user-123',
      metadata: {
        operationType: 'write',
        path: '/local/1',
        error: 'Offline error',
      }
    });
    expect(queueActionMock.mock.calls[0][3]).toBe('genesis-1');
  });

  it('should handle errors in logSystemEvent', async () => {
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      writable: true,
    });

    const { addDoc } = await import('firebase/firestore');
    const addDocMock = vi.mocked(addDoc);
    addDocMock.mockRejectedValueOnce(new Error('Failed to add document'));

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const error = new Error('Some error');
    handleFirestoreError(error, OperationType.LIST, '/list/1');

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0][0]).toBe('[AUDIT LOG FAILED]');

    consoleWarnSpy.mockRestore();
  });

  it('should fall back to "system" user when offline and no currentUser', async () => {
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      writable: true,
    });

    // Change the auth mock to simulate no logged in user
    const originalCurrentUser = auth.currentUser;
    // @ts-ignore
    auth.currentUser = null;

    const { syncService } = await import('../services/syncService');
    const queueActionMock = vi.mocked(syncService.queueAction);
    queueActionMock.mockClear();

    const error = new Error('Offline error no user');
    handleFirestoreError(error, OperationType.WRITE, '/local/2');

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(queueActionMock).toHaveBeenCalledTimes(1);
    expect(queueActionMock.mock.calls[0][2].userId).toBe('system');

    // Restore auth currentUser
    // @ts-ignore
    auth.currentUser = originalCurrentUser;
  });
});
