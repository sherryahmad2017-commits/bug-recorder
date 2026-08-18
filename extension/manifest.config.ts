import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// Phase 1 scope: sign in and pick a project. No capture/webRequest permissions
// are requested yet because nothing in this build uses them — the capture
// permissions (activeTab, scripting, desktopCapture, webRequest, alarms) get
// added in Phase 2/3 alongside the features that need them, per
// docs/ARCHITECTURE.md §26 ("request only permissions required for the
// current feature").
export default defineManifest({
  manifest_version: 3,
  name: 'ReproFlow',
  short_name: 'ReproFlow',
  version: pkg.version,
  description: 'Record a problem once. Reproduce it instantly. Sign in and choose a project to start reporting bugs.',
  icons: {
    16: 'public/icons/icon-16.png',
    32: 'public/icons/icon-32.png',
    48: 'public/icons/icon-48.png',
    128: 'public/icons/icon-128.png',
  },
  action: {
    default_title: 'ReproFlow',
    default_icon: {
      16: 'public/icons/icon-16.png',
      32: 'public/icons/icon-32.png',
      48: 'public/icons/icon-48.png',
      128: 'public/icons/icon-128.png',
    },
  },
  side_panel: {
    default_path: 'src/panel/index.html',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['storage', 'sidePanel'],
  minimum_chrome_version: '116',
});
