# Mobile-Friendly Sidebar Patch

This patch makes your app work properly on phones by:
1. Hiding the sidebar behind a hamburger menu on phones
2. Adding a top app bar on phones (logo + hamburger + avatar)
3. Sidebar slides in when you tap the hamburger
4. Backdrop dims the page when the sidebar is open
5. Auto-closes when you tap a link

On desktop (md screen width and up), nothing changes — the sidebar stays
fixed on the left like before.

## Apply

```bash
cd ~/Downloads/Construction/cims-v3
unzip -o ~/Downloads/mobile-fix.zip
```

This overwrites:
- `app/(app)/_components/sidebar.tsx`

## Then update your app/(app)/layout.tsx

The main content area currently has `ml-64` (margin-left 256px) to make
space for the sidebar. On mobile that's wrong because the sidebar is
hidden — that 256px margin would push everything off-screen.

Open `app/(app)/layout.tsx`. Find the `<main>` tag (or wrapper div around
{children}). Look for a className that includes `ml-64`.

You'll see something like:

```tsx
<main className="ml-64 p-8">
  {children}
</main>
```

CHANGE it to:

```tsx
<main className="md:ml-64 pt-14 md:pt-0 px-4 py-4 md:px-8 md:py-8">
  {children}
</main>
```

What this does:
- `md:ml-64` — only apply 256px left margin on desktop+
- `pt-14 md:pt-0` — on mobile, add 56px top padding (for the app bar). On
  desktop, no extra top padding.
- `px-4 py-4 md:px-8 md:py-8` — smaller padding on mobile, normal on desktop

## Test

```bash
npm run dev
```

Open on your phone (your live URL) or use Chrome DevTools mobile mode:
1. Open DevTools (F12)
2. Click the device-toolbar icon (looks like a phone)
3. Pick "iPhone 12 Pro" or similar from the dropdown

You should see:
- ✅ Top bar with hamburger icon (left), logo (center), avatar (right)
- ✅ No sidebar visible
- ✅ Tap hamburger → sidebar slides in from left, backdrop appears
- ✅ Tap a nav link → page navigates AND sidebar closes
- ✅ Tap backdrop OR close button OR press ESC → sidebar closes
- ✅ Resize wider than ~768px → top bar disappears, sidebar appears fixed

## Push

```bash
git add .
git commit -m "Mobile-friendly: hamburger menu sidebar"
git push
```

## Next stage

After this works, the next mobile fix is the GRID — making KPI cards 2-up
on phones instead of stacked, and making tables scroll horizontally
properly. Tell me when this works and we'll move to that.
