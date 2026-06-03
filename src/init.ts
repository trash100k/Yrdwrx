try {
  let x = window.localStorage;
  x.setItem('__test__', '1');
  x.removeItem('__test__');
  let y = window.sessionStorage;
  y.setItem('__test__', '1');
  y.removeItem('__test__');
  let z = window.indexedDB;
} catch (e) {
  try {
    const dummyStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0
    };
    Object.defineProperty(window, 'localStorage', {
      value: dummyStorage,
      writable: true,
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: dummyStorage,
      writable: true,
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(window, 'indexedDB', {
      value: null,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (innerErr) {
    // Ignore redefine errors
  }
}
