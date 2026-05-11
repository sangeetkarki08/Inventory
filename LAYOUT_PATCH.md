// =============================================================================
//  PATCH INSTRUCTIONS for app/layout.tsx
//
//  You need to ADD PWA metadata to the existing root layout. I don't know the
//  exact contents of your current layout.tsx, so here's a generic block to add.
//
//  STEP 1: Open `app/layout.tsx`
//
//  STEP 2: Find the existing `metadata` export (likely near the top after
//          imports). It probably looks like:
//
//          export const metadata: Metadata = {
//            title: 'ConstructionIMS v3',
//            description: '...',
//          };
//
//  STEP 3: REPLACE that metadata export with this expanded version:
// =============================================================================

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'ConstructionIMS v3 — Store Management',
  description: 'Construction inventory management with FIFO stock tracking',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ConstructionIMS',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
};

// NEW: separate viewport export (Next 14+ pattern). Add this if you don't
// already have one.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F59E0B',
};

// =============================================================================
//  IMPORTANT NOTES:
//
//  1. If your layout already has a Metadata import line, leave it alone.
//
//  2. If your layout doesn't already have a `viewport` export, add it after
//     the metadata.
//
//  3. The actual <html>, <body> wrapping in your layout doesn't need any
//     changes. Just the metadata.
//
//  4. After you save and rebuild, the manifest will be picked up automatically.
// =============================================================================
