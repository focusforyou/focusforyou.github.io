Animated profile uploads use a dedicated worker and a locally hosted codec bundle; no upload service receives the original file. Avatar and banner share drag/zoom crop controls. JPEG remains below 40,000 data-URI characters; GIF remains below 180,000, 120 frames and 24 MiB of decoded output. Existing Firebase rules therefore apply without a policy change.

Input: at most 20 MiB, 2048 pixels per side, 1.5 million canvas pixels, 300 frames and 60 million canvas-pixels across frames. The worker handles frame disposal and transparency before cropping, samples longer animations while accumulating delays, and reduces resolution/colours to fit storage limits. It preserves repeat count. Cancellation/account changes terminate pending workers; a 45-second timeout limits processing.

Vendor bundle: gifuct-js 2.1.2, gifenc 1.0.3 and js-binary-schema-parser 2.0.3, all MIT. Licenses are in vendor/gif-codec-LICENSE.txt. To rebuild, extract those exact npm package archives into gif-build/<package>/package, then run python gif-build/bundle.py. The build only wraps CommonJS sources and does not execute downloaded build scripts.

Themes: forest, ocean, dusk extend the existing local preference and early page bootstrap. They use flat surfaces and the existing star canvas, with no additional animation.

Browser checks: 320×720 and 390×844, plus a 320×430 reduced viewport for keyboard-like height constraints. Avatar and banner conversion, real banner file picker, draft save/discard bar, settings themes, profile appearance grids, room creation and route width checks. Physical Android keyboard and cloud saving were not exercised by the isolated preview account.
