import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cutty.app',
  appName: 'Cutty',
  webDir: 'dist',
  plugins: {
    Camera: {
      "ios": {
        "cameraUsageDescription": "We need access to your camera to take project site and inventory photos.",
        "photoLibraryUsageDescription": "We need access to your photos to upload existing snapshots."
      }
    }
  }
};

export default config;
