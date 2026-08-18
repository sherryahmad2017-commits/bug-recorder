import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

// Phase 1 scope: sign in and pick a project. No capture/webRequest permissions
// are requested yet because nothing in this build uses them — the capture
// permissions (activeTab, scripting, desktopCapture, webRequest, alarms) get
// added in Phase 2/3 alongside the features that need them, per
// docs/ARCHITECTURE.md §26 ("request only permissions required for the
// current feature").
// Pins the extension's ID (kjmjhhindcpepbobcclcgffjdelbdjpb) across unpacked
// loads, rebuilds, and the eventual Web Store upload, instead of Chrome
// assigning a new random ID each time. The matching private key is
// .extension-key.pem, gitignored — never publish or commit it. This is a
// standard, documented Chrome mechanism (not a workaround).
const EXTENSION_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuu8pkgSkp+ctiuCR3tnZV5o0u2R0Dvr3ZaPvk+Mo6FDaVokjPoDI6piQgdKpyuPlixZCCLPcQD1Bxtfrk0LnQqXu7IQf/DyVM/w4ZiTr43/6sKO9WYBCZCcs+ByJ2mjyVmgQOcZIAqqQpC/ZFipLUSWizccyfhFCjoHkA4LbDM5fOWWtfNFujz7GqDU5s/Rhk9DMwvFbRIA+3nbMMLMov27+J12Mm/TeEWySkj4emyz7ka/uABjTZWTgSc5+oH4prhM+/P0mTlImIV9uQ3ATLnQfdnsf+IvjH50E9Zn5WTrk60pSOWoyQrDVVrz4S6XYaLMzU8DrAL7Q2aw7lMIv4wIDAQAB';

export default defineManifest({
  manifest_version: 3,
  name: 'ReproFlow',
  short_name: 'ReproFlow',
  version: pkg.version,
  key: EXTENSION_PUBLIC_KEY,
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
