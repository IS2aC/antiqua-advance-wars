# Commande : sprite de carte / carthage / convoi-rouge.png

- Références à joindre : `art/raw/sprites-unités/peuples/carthage/cavaliers_lourds-rouge.png` (image 1, format), `art/reference/peuples/carthage.png` (image 2, apparence)
- Livrable : `art/codex/livraisons/sprites/carthage/convoi-rouge.png`

## Prompt

```text
Two reference images are attached. Image 1 is the FORMAT reference: an existing pixel-art sprite sheet of this game (4 columns x 4 rows on flat magenta). Copy exactly its format: the same grid, the same cell size, the same pixel size, the same chibi proportions, the same outline and shading style, the same poses and animation cycle in every cell, the same overall silhouette size. Image 2 is the LOOK reference: a character sheet of the people this unit belongs to; use it only for skin tone, face, hair, clothing, gear and emblem.

STYLE: true pixel art sprite for a top-down tactical turn-based strategy game in the spirit of early-2000s handheld consoles. Each sprite is exactly 32x32 pixels, drawn on a strict pixel grid, scaled up 8x with nearest-neighbor so every game pixel is a perfect 8x8 square block. No anti-aliasing, no blur, no gradients, no dithering noise, no shadows outside the sprite. Chunky chibi proportions (big head, about 2 heads tall), readable silhouette, 1-pixel dark brown outline (#2B1B17), light from the top-left. Limited palette, max 12 colors per sprite.
TEAM COLOR: the parts marked team-red use ONLY these 4 reds: #4A1218, #8E1F24, #D13A2E, #F2735A, even if the look reference shows another color there (the game recolors this red into the people's color). Never use these reds anywhere else, not in the skin, not in the wood, not in the gold.
Background: flat solid magenta #FF00FF, no ground, no scenery. No text, no labels, no numbers.

LAYOUT: one sprite sheet, 4 columns x 4 rows, each cell 32x32 game pixels with 2 game pixels of magenta padding, same character in every cell, identical size and proportions.
Row 1 - IDLE facing right, 3 frames: neutral, breathing up 1 pixel, neutral with slight weapon sway. 4th cell empty.
Row 2 - WALK facing right (side view), 4 frames: contact, passing, contact (other leg), passing.
Row 3 - WALK facing up (back view), 4 frames, same cycle.
Row 4 - WALK facing down (front view), 4 frames, same cycle.
Feet always touch the bottom pixel row of the cell. Head may bob 1 pixel, never more. No horizontal drift inside the cell.

UNIT: Carthaginian covered carriage. A four-wheeled wooden carriage with an enclosed cabin (team-red cloth roof and curtains, the gold sign of Tanit on the side), pulled by one brown mule with a team-red blanket, driven by an olive-skinned driver in a team-red tunic seated in front. No weapons. Nothing at all below the wheels.
```
