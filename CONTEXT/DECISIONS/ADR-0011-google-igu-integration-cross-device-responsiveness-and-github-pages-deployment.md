# ADR-0011: Google IFrame Integration (igu=1), Cross-Device Responsiveness, and GitHub Pages Deployment

- **Status**: Accepted
- **Date**: 2026-10-19
- **Deciders**: Autonomous Core Engineering, Security Reviewer

## Context
When loading `https://www.google.com` or `google` directly inside a browser webview `<iframe>` (both locally and when hosted statically on GitHub Pages), modern browsers trigger the error `www.google.com refused to connect` (`ERR_BLOCKED_BY_RESPONSE`). This occurs because Google by default returns `X-Frame-Options: SAMEORIGIN` and `Content-Security-Policy: frame-ancestors 'self'`.

Furthermore, for static GitHub Pages deployments (`https://fsferdows.github.io/OpenBrowser/`), root-relative URLs such as `/newtab.html` or `/assets/` fail because GitHub Pages serves the repository under a subpath (`/OpenBrowser/`). Additionally, the browser UI chrome needs complete responsive adaptation for mobile (320px–480px), tablet (768px–1024px), and desktop viewports, avoiding viewport compression and broken layouts.

## Decisions

1. **Google Frame Embedding Strategy (`igu=1`)**:
   - Utilize Google's standard embedding parameter `igu=1` ("Iframe Google Unleashed").
   - When requests target Google (`google.com`, `www.google.com`, `https://www.google.com`), normalize the destination to `https://www.google.com/webhp?igu=1` for the search homepage, and `https://www.google.com/search?igu=1&q=...` for query execution.
   - Verification confirms Google emits no `X-Frame-Options` and no `frame-ancestors` blocking headers when `igu=1` is present, allowing standard iframe rendering without refusal errors across both static and proxied environments.

2. **Cross-Environment Resolution (Static vs Proxied)**:
   - On static hosting (GitHub Pages, file://, or non-proxied environments), load `https://www.google.com/webhp?igu=1` directly into the iframe viewport.
   - When running against the local Node.js proxy (`serve-localhost.mjs`), preserve `igu=1` while stripping frame-busting scripts and allowing frame ancestors.
   - Omnibox search defaults to Google with an interactive engine toggle between Google and Braver Search.

3. **Cross-Device Responsive Architecture**:
   - **Mobile (< 768px)**:
     - The viewport pane (`.browser-viewport-pane`) expands to 100% height.
     - The autonomous sidebar (`.brave-sidebar-pane`) transforms from a desktop sidecar into a smooth bottom drawer / full-screen overlay sheet on toggle.
     - Toolbar navigation prioritizes essential controls (Back, Reload, Omnibox, Shields, Menu) while hiding desktop-only elements (window traffic lights, auxiliary action buttons).
     - Bookmarks bar collapses informational copy and displays a horizontal scrollable chip bar.
     - Popovers convert into responsive bottom sheets.
   - **Tablet (768px–1024px)**:
     - Fluid flex layout with adaptive Omnibox width and compact side dock.
   - **Sub-pages (`newtab.html`, `search.html`)**:
     - Adapt grid metrics, search inputs, and knowledge cards for mobile viewports without horizontal clipping.

4. **GitHub Pages Deployment**:
   - Convert all internal paths to relative notation (`newtab.html`, `search.html`, `assets/...`) or dynamic base resolution to prevent root-domain 404s on repository subpaths.
   - Create GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) for automated artifact generation and GitHub Pages publication from `main`.

## Consequences
- Authentic Google search renders directly inside the browser viewport without connection refusal.
- Fully operational static deployment on GitHub Pages (`https://fsferdows.github.io/OpenBrowser/`).
- Seamless UX across smartphones, tablets, laptops, and ultra-wide screens.
