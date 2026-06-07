class SafeStorage {
  private memoryFallback: Record<string, string> = {};

  private get isSupported(): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const storage = window.localStorage;
      const testKey = '__test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  getItem(key: string): string | null {
    if (this.isSupported) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        // Fallback
      }
    }
    return this.memoryFallback[key] || null;
  }

  setItem(key: string, value: string): void {
    if (this.isSupported) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback
      }
    }
    this.memoryFallback[key] = value;
  }

  removeItem(key: string): void {
    if (this.isSupported) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        // Fallback
      }
    }
    delete this.memoryFallback[key];
  }
}

export const safeStorage = new SafeStorage();
