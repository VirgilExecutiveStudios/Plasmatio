# Page directory

`directory.js` initializes the registry. Each page file defines its original artwork, individually responding elements, tool icons, and allowed navigation targets.

| File | Screen | Original artwork |
| --- | --- | --- |
| welcome.js | Welcome | assets/1.png |
| home.js | Landing page | assets/2.png |
| forge.js | Forge | assets/3.png |
| office.js | Office | assets/4.png |
| arena.js | Arena | assets/5.png |
| settings.js | Settings | assets/6.png |

The primary page directory contains only Forge, Office, Arena and Settings. The current symbol appears first; the other three appear vertically below it when expanded. All four use the same 56 × 48 frame, with 56 pixels between rows. The neighboring toolbar moves down 168 pixels.

Coordinates use the original 1366 × 768 reference space. The entire stage scales uniformly. Each `elements` entry registers with Heptagon automatically. `cutouts` split nested artwork, such as prompt lettering and microphone, so they respond independently without duplicating pixels. A residual artwork layer preserves pixels outside the named bounds.
