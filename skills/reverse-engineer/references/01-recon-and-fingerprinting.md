# 01. Recon and Fingerprinting

Contents: principle, where to look, signal tables by layer, confidence rules, STACK.md format.

## Principle
Collect signals from several independent places. One signal is a hint. Two or more independent signals is a finding. Write the signals down next to the claim.

## Where to look (in this order)
1. **Response headers** (`curl -sI <url>`): `server`, `x-powered-by`, `via`, `x-vercel-id`, `cf-ray`, `x-amz-cf-id`, `x-nf-request-id`, `set-cookie` names, `content-security-policy` (lists third party hosts, which reveals services), `link` preload hints.
2. **Raw HTML** (view source, not the rendered DOM): meta tags, `<script>` URLs, inline JSON blobs, `<link rel=manifest>`, generator tag.
3. **Rendered DOM** (what `dom_inventory.cjs` saves): class patterns, data attributes, ARIA patterns, portals.
4. **Page globals** (`window` keys): see tables below. `dom_inventory.cjs` checks these automatically.
5. **Network tab** during real use: API hosts, protocols, payload shapes, websockets, SSE, third party SDKs.
6. **Bundles and chunk names**: `webpackChunk*`, `/_next/`, `/assets/index-*.js` (Vite), `/build/` (Remix), `/_astro/`.
7. **Source maps**: look for `//# sourceMappingURL=` at the end of JS files. If publicly served, the `sources` list shows the original file tree and package names. Use it to understand architecture. Do not copy the code.
8. **Storage and workers**: IndexedDB names, localStorage keys, service worker scripts, Cache names.
9. **Well-known files**: `/robots.txt`, `/sitemap.xml`, `/manifest.json`, `/.well-known/`, `/openapi.json`, `/graphql`.

## Signal tables

### Frameworks and meta-frameworks
| Finding | Signals |
|---|---|
| React | `_reactListening*` keys on root, `__REACT_DEVTOOLS_GLOBAL_HOOK__`, fiber keys on nodes (`__reactFiber$...`) |
| Next.js | `/_next/static/`, `<script id="__NEXT_DATA__">`, `window.next`, `/_next/image` URLs |
| Remix / React Router 7 | `window.__remixContext`, `?_data=` requests |
| Vue | `__vue_app__`, `data-v-xxxx` scoped style attributes |
| Nuxt | `window.__NUXT__`, `/_nuxt/` |
| Svelte / SvelteKit | `svelte-xxxx` classes, `/_app/immutable/` |
| Angular | `ng-version` attribute, `_ngcontent-*` |
| Solid | `data-hk` hydration keys |
| Qwik | `q:container` attribute |
| Astro | `astro-island`, `/_astro/` |
| Vite | `/@vite/client` in dev, `/assets/index-[hash].js` in prod |
| Webpack | `webpackChunk<name>` global |
| jQuery | `window.jQuery` |
| HTMX / Alpine | `hx-*`, `x-data` attributes |

### Site builders and CMS
| Finding | Signals |
|---|---|
| WordPress | `/wp-content/`, `/wp-json/`, generator meta |
| Elementor | `elementor-element`, `elementor-widget-*`, `data-elementor-type` |
| Webflow | `data-wf-page`, `data-wf-site`, `w-` classes |
| Framer | `data-framer-*`, `framerusercontent.com` |
| Wix / Squarespace / Shopify | `wixstatic.com` / `static1.squarespace.com` / `cdn.shopify.com` |
| Headless CMS | `cdn.contentful.com`, `cdn.sanity.io`, Strapi `/api/` shapes |

### Styling system
| Finding | Signals |
|---|---|
| Tailwind | Utility class soup (`flex items-center gap-2 px-4 text-sm`), `--tw-*` variables, `dark:` variants |
| CSS Modules | Hashed names like `Button_primary__3xK9a` |
| styled-components | `sc-` classes, `<style data-styled>` |
| Emotion | `css-<hash>` classes, `<style data-emotion>` |
| vanilla-extract / Panda / StyleX | Short hashed atomic classes in static CSS |
| Bootstrap | `container`, `row`, `col-md-*`, `btn btn-primary` |

### Component libraries and primitives
| Finding | Signals |
|---|---|
| Radix UI | `data-radix-*`, `data-state="open|closed|checked"`, `data-side`, `[data-radix-popper-content-wrapper]`, ids like `radix-:r1:` |
| shadcn/ui | Radix signals plus Tailwind and `data-slot` attributes |
| React Aria Components | `data-rac`, `react-aria-*` classes, `data-pressed`, `data-focus-visible` |
| Headless UI | `headlessui-*` ids, `data-headlessui-state` |
| Ark UI / Zag | `data-scope`, `data-part` |
| MUI | `Mui*` classes |
| Chakra | `chakra-*` classes |
| Ant Design | `ant-*` classes |
| Mantine | `mantine-*` classes, `--mantine-*` variables |
| Web components | custom elements with shadow roots (`md-*`, `sl-*`) |

### Rich content engines
| Finding | Signals |
|---|---|
| ProseMirror / TipTap | `.ProseMirror`, `.tiptap` |
| Lexical | `data-lexical-editor` |
| Slate | `data-slate-editor` |
| Quill / Draft.js | `.ql-editor`, `.public-DraftEditor-content` |
| Monaco / CodeMirror | `.monaco-editor` / `.cm-editor` |
| Charts | `.recharts-wrapper`, `.highcharts-container`, `_echarts_instance_`, `.apexcharts-canvas`, Chart.js canvas |
| Maps | `.leaflet-container`, `.mapboxgl-map`, `.maplibregl-map`, `gm-style` |
| Data grids | `ag-root`, `.dx-datagrid`, `.handsontable` |

### Rendering engines (when the DOM is empty)
| Finding | Signals |
|---|---|
| Canvas 2D / WebGL | `<canvas>` elements; patch `getContext` in an init script to log context type |
| Three.js | `window.THREE`, `__THREE__`, `THREE.REVISION` |
| PixiJS | `window.PIXI`, `__PIXI_APP__`, `PIXI.VERSION` |
| Konva / Fabric / Paper / p5 / Two | `window.Konva`, `window.fabric`, `window.paper`, `window.p5`, `window.Two` |
| Babylon / PlayCanvas | `window.BABYLON`, `window.pc` |
| WebGPU | `navigator.gpu` calls |
| WASM | `.wasm` requests, `WebAssembly.instantiate` calls |
| Animation | `window.gsap`, `lottie`, `rive`, `anime`, framer-motion inline transforms, CSS `@keyframes` |
| Media export | `MediaRecorder`, `VideoEncoder`, `@ffmpeg/core` requests, `gif.js` worker |
| Fonts | `opentype` global, `fontkit`, `.woff2` requests, `FontFace` usage |

### Backend and platform services
| Finding | Signals |
|---|---|
| Firebase | `firebaseio.com`, `firestore.googleapis.com`, `identitytoolkit.googleapis.com` |
| Supabase | `*.supabase.co`, `/rest/v1/`, `/auth/v1/`, `/realtime/v1/` |
| Convex / Appwrite / PocketBase | `convex.cloud`, `appwrite.io`, `/api/collections/` |
| GraphQL | `POST /graphql`, `operationName` in body, `__APOLLO_STATE__` |
| tRPC | `/api/trpc/` with batch params |
| Realtime | WebSocket upgrade, SSE, Socket.IO, Pusher, Ably, Liveblocks, PartyKit, Yjs |
| Auth | Clerk, Auth0, NextAuth (`/api/auth/session`), Supabase Auth, Firebase Auth, Cognito |
| Payments | `js.stripe.com`, Paddle, Lemon Squeezy, PayPal |
| Search | Algolia, Typesense, Meilisearch, Elastic hosts |
| AI | calls to model provider APIs, or a first party `/api/chat` proxy with streaming |
| Storage / CDN | S3 presigned URLs, Cloudinary, Uploadthing, imgix, R2 |
| Analytics / errors | GA, GTM, Segment, PostHog, Mixpanel, Amplitude, Sentry, LogRocket |
| Hosting | Vercel, Netlify, Cloudflare, CloudFront, Fly, Render (see headers) |

### State management hints
Redux (`redux-persist` keys), Zustand (localStorage entry shaped `{state, version}`), MobX, Jotai, Recoil, Pinia (`__pinia`), Vuex (`$store`), XState, React Query (refetch on focus, `queryKey` caching), SWR.

### Browser extensions
Read `manifest.json` (`manifest_version`, `permissions`, `host_permissions`, `content_scripts`, `background.service_worker`, `action`, `side_panel`), injected shadow roots, message passing.

## Confidence rules
- **High**: two or more independent signals, or an explicit self-identifying signal.
- **Medium**: one strong signal, or several weak ones.
- **Low**: a single weak signal, or consistent with several options.
Never write "uses X" for Low. Write "possibly X, verify by Y".

## STACK.md format
```
# Stack: <tool>
Evidence date: <date>   Reference URL: <url>

| Layer | Finding | Confidence | Evidence |
|---|---|---|---|
| Framework | Next.js App Router | High | `/_next/static`, `__NEXT_DATA__` |
| Styling | Tailwind + shadcn/ui | High | utility classes, `data-state`, Radix wrappers |
| Rendering | DOM + Canvas 2D stage | High | `<canvas id=stage>`, 2d context log |
| State | Zustand (persisted) | Medium | localStorage `app-store` shape |
| Backend | Supabase | High | `/rest/v1/` and `/auth/v1/` calls |
| Unknown | Export pipeline | Low | MediaRecorder seen, confirm |

## Open questions
- ...
```

### Elementor / WordPress specifics
- Detect via `elementor-element`, `data-elementor-type`, `elementor-widget-*` classes.
- `dom_inventory` globals probe returns Elementor kit CSS variable count (`--e-global-*`) and a sample of widget types when present.
- Prefer native Elementor widgets + global styles / kit tokens when targeting WordPress rebuilds; custom CSS or a small plugin only when the widget set cannot express the control.
