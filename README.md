# Alpha Contrast v2.0

Reads the visible content behind an element via the browser's own compositing engine and recolors it to display the contrasting color — masked to the element's foreground shape.

## How It Works

Uses CSS `backdrop-filter` for the color transform (GPU-accelerated, reads the actual composited backdrop) and CSS `mask-image` to clip the effect to the foreground shape's alpha channel.

## Quick Start

Add the script to your page and give any element the class `alphacontrast`:

```html
<script src="alphacontrast.js"></script>

<!-- simple full-element inversion -->
<div class="alphacontrast"><h1>Hello World</h1></div>

<!-- image mask with complement mode -->
<div class="alphacontrast" data-ac-mode="complement">
  <img src="logo.png" alt="Logo"/>
</div>

<!-- SVG mask with bw mode -->
<div class="alphacontrast" data-ac-mode="bw">
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="50"/>
  </svg>
</div>
```

## Data Attributes

| Attribute | Description | Default |
|---|---|---|
| `data-ac-src` | Explicit mask image URL (overrides child detection) | — |
| `data-ac-mode` | `"invert"` \| `"complement"` \| `"bw"` \| `"luminance"` | `"invert"` |
| `data-ac-fill` | Background color on the overlay | `transparent` |
| `data-ac-threshold` | `contrast()` strength for bw mode | `100` |
| `data-ac-mask-size` | CSS `mask-size` value | `"100% 100%"` |

## Modes

| Mode | Effect | CSS |
|---|---|---|
| `invert` | Full RGB inversion | `backdrop-filter: invert(1)` |
| `complement` | Hue rotation 180° | `backdrop-filter: hue-rotate(180deg)` |
| `bw` | Black or white by luminance | `backdrop-filter: invert(1) contrast(N)` |
| `luminance` | Lightness inversion, hue preserved | `backdrop-filter: invert(1) hue-rotate(180deg)` |

## JavaScript API

```js
AlphaContrast.scan()                 // re-scan DOM for .alphacontrast
AlphaContrast.init(el [, opts])      // manually initialise one element
AlphaContrast.refresh([el])          // rebuild mask (one or all)
AlphaContrast.setMode(el, mode)      // change mode live
AlphaContrast.destroy(el)            // tear down one
AlphaContrast.destroyAll()           // tear down all
AlphaContrast.registerMode(name, backdropFilterCSS)
```

## Installation

**Browser (script tag):**
```html
<script src="alphacontrast.js"></script>
```

**npm:**
```bash
npm install alphacontrast
```

```js
const AlphaContrast = require('alphacontrast');
```

## License

[GPL-3.0](LICENSE)
