# Feature Specification: SplitFrame — Custom-Grid Photo Collage Editor

**Feature Branch**: `001-splitframe-collage-editor`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "c:\Projects\SplitFrame\collage-app-prompt.md" — SplitFrame, a browser-only app where users split a canvas into cells (with presets or by drawing their own lines, straight or freehand), put a photo in each cell, and export the result as one merged image. Similar to Instagram Story "Layout", except users can draw their own grid.

## Clarifications

### Session 2026-09-23

- Q: When a divider is deleted and one or both sides contain more dividers, what happens? → A: Everything on both sides merges into one cell that keeps the first photo (see FR-019).

### Session 2026-09-24

- Q: Are drawn lines limited to horizontal and vertical? → A: No. Lines are drawn freehand and can be diagonal, bent (for example an L shape) or curved, so cells can have any shape. Reference sketch: three corner cuts, one long vertical line, one horizontal line that starts slightly past the vertical line, and two L-shaped lines, giving 8 cells.
- Q: When a freehand stroke is finished, is it tidied into straight pieces or kept as drawn? → A: Kept as drawn, smoothed only to remove hand jitter. A stroke that is almost straight and almost horizontal or vertical still becomes an exact straight line, so grids stay crisp.
- Q: What happens to the parts of a stroke that overshoot an edge or another line? → A: They are ignored. A stroke only splits the cells it crosses from edge to edge.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Make a collage from a preset layout and export it (Priority: P1)

A user opens SplitFrame, picks a canvas shape (for example 9:16 Story), picks a preset layout (for example 3 columns), adds a photo to each cell, and downloads one merged image at full resolution.

**Why this priority**: This is the smallest complete path from "I have photos" to "I have a collage file". Without it, nothing else has value.

**Independent Test**: Choose 9:16 and "2 columns", add two photos, export as PNG. The downloaded file is 1080×1920 and shows both photos filling their halves.

**Acceptance Scenarios**:

1. **Given** the editor is open, **When** the user picks an aspect ratio preset (9:16, 1:1, 4:5, 16:9), **Then** the preview canvas changes to that shape and the current layout is kept, scaled to the new shape.
2. **Given** the user chooses Custom size, **When** they enter a width and height in pixels, **Then** the canvas takes that shape and the export uses exactly those dimensions.
3. **Given** any canvas, **When** the user picks a layout preset (2, 3 or 4 columns; 2 or 3 rows; 2×2 grid), **Then** the canvas shows that many equal empty cells.
4. **Given** an empty cell, **When** the user clicks or taps it (or focuses it and presses Enter), **Then** a picker opens that accepts image files only; the chosen image fills the cell edge to edge with no empty space and no distortion (cover fit).
5. **Given** an empty cell, **When** the user drops an image file onto it, **Then** the image is placed in that cell the same way.
6. **Given** a finished collage, **When** the user exports as PNG, **Then** an image file downloads at the full target resolution, named `splitframe-YYYYMMDD-HHmm.png` using the local date and time.
7. **Given** a finished collage, **When** the user exports as JPG with a chosen quality, **Then** a JPG file at that quality downloads with the same naming pattern and a `.jpg` extension.
8. **Given** some cells are still empty, **When** the user exports, **Then** those cells appear in the background color in the exported file.

---

### User Story 2 - Position photos inside cells (Priority: P1)

A user adjusts how each photo sits inside its cell: moves it to show the right part, zooms in, or resets it.

**Why this priority**: Cover fit crops photos. Without a way to adjust the crop, many collages look wrong (heads cut off, subject off-center), so the P1 result would often be unusable.

**Independent Test**: Put a wide landscape photo in a tall cell, drag it sideways to reveal a different part, zoom in, export, and confirm the export shows exactly the framing seen in the editor.

**Acceptance Scenarios**:

1. **Given** a filled cell in Arrange mode, **When** the user drags inside it (mouse, touch or pen), **Then** the photo moves with the pointer and can never be moved far enough to leave empty space in the cell.
2. **Given** a filled cell, **When** the user scrolls the wheel or pinches over it, **Then** the photo zooms around the pointer or pinch center, and cannot zoom out past the size where it just covers the cell.
3. **Given** a moved or zoomed photo, **When** the user double-clicks or double-taps it, or chooses "Reset position", **Then** it returns to the default centered cover fit.
4. **Given** a filled cell, **When** the user chooses "Replace", **Then** a picker opens and the new photo replaces the old one with the default fit; **When** they choose "Remove", **Then** the cell becomes empty.
5. **Given** a collage with adjusted photos, **When** it is exported, **Then** each cell in the file shows the same crop, position and zoom as the editor preview.
6. **Given** two filled cells, **When** the user drags a photo from one cell and drops it on another, **Then** the two photos swap cells, each getting the default fit. *(Nice to have — see Assumptions.)*

---

### User Story 3 - Draw your own lines, straight or freehand (Priority: P2)

A user switches to Custom mode ("Draw lines") and splits the canvas by drawing lines freely with a finger, mouse or pen, starting from a preset or from one blank cell. Lines can be straight, diagonal, bent (like an L) or curved. Nearly straight horizontal or vertical strokes become exact straight lines; every other stroke keeps its drawn shape, smoothed to remove jitter.

**Why this priority**: This is what sets SplitFrame apart from standard collage apps. It relies on Stories 1 and 2 to deliver a finished image, so it comes after them.

**Independent Test**: On a blank canvas, draw the reference sketch from the clarifications: a long rough vertical line, a horizontal line to the right edge that starts slightly left of the vertical line, three diagonal corner cuts and two L-shaped strokes. The result is 8 cells. The vertical line is perfectly straight, the corner cuts and L's keep their drawn shape, and the overshoot of the horizontal line did not split the left side.

**Acceptance Scenarios**:

1. **Given** any layout, **When** the user enters Custom mode, **Then** the current layout stays and can be refined; a "Clear" action resets it to one blank cell.
2. **Given** Draw lines mode, **When** the user drags on the canvas, **Then** a live preview of the line follows the stroke.
3. **Given** a stroke that is almost straight and within a few degrees of horizontal or vertical, **When** the user releases it, **Then** it becomes a perfectly straight horizontal or vertical line that spans the full width or height of the cells it splits.
4. **Given** a diagonal, bent or curved stroke, **When** the user releases it, **Then** the line keeps the drawn shape (smoothed) and the cells it crosses take on shapes bounded by that line, for example a triangle-like corner or an L-shaped region.
5. **Given** a stroke that runs past a canvas edge or past an existing line, **When** it is released, **Then** the part beyond that edge or line is ignored and only the cells the stroke crosses from edge to edge are split.
6. **Given** a stroke that ends just short of an edge or line (within about 16 screen pixels), **When** it is released, **Then** the line is extended to meet that edge or line.
7. **Given** a stroke that crosses several cells, **When** it is released, **Then** each crossed cell is split along the stroke, and cells the stroke did not cross are unchanged.
8. **Given** a straight horizontal or vertical stroke close to (within about 8 screen pixels of) the canvas center, a third, or an existing parallel edge, **When** the user drags, **Then** a guide shows the snap target, and on release the line lands exactly on it.
9. **Given** a stroke that would make any resulting cell smaller than the minimum cell size, **When** the user drags, **Then** a visual warning shows while dragging, and on release no split is made.
10. **Given** a stroke that crosses itself, or that never reaches an edge or line, **When** it is released, **Then** no split is made and a short hint explains why ("Lines can't cross themselves" or "Draw from edge to edge").
11. **Given** Draw lines mode is active, **When** the user looks at the screen, **Then** a clear mode indicator says dragging will draw lines; in Arrange mode it says dragging moves photos.
12. **Given** a cell with a photo is split, **When** the split is made, **Then** the photo stays in one of the new cells with its fit recalculated and the other new cell is empty. For a straight horizontal or vertical line, the photo stays in the top or left part; for any other line, it stays in the larger part.
13. **Given** a stroke being dragged across a cell that holds a photo, **When** the preview line is shown, **Then** the photo preview already shows how it will be cropped into its new cell, so the user can see the result before releasing.

---

### User Story 4 - Adjust and remove dividers, with undo/redo (Priority: P2)

A user fine-tunes the grid by dragging dividers, removes unwanted dividers, and undoes or redoes any change.

**Why this priority**: Drawn and preset grids almost always need adjusting. Undo makes experimenting safe.

**Independent Test**: With a 2-column layout, drag the divider to about 30/70, delete it, then press undo twice. The layout returns to 2 equal columns.

**Acceptance Scenarios**:

1. **Given** a straight horizontal or vertical divider between rectangular regions, **When** the user hovers over it, **Then** the cursor shows a resize indicator; **When** they drag the divider, **Then** the cells on both sides resize live (shaped cells inside them stretch with them) and photos stay covering their cells. Freehand dividers can be selected and removed but not dragged.
2. **Given** a divider being dragged, **When** it reaches the point where a cell would drop below the minimum size, **Then** it stops moving further in that direction.
3. **Given** a selected divider, **When** the user presses Delete or Backspace, or taps the × handle on it, **Then** the divider is removed and the two sides merge into one cell. If both sides had a photo, the photo from the first side (top or left) is kept, and the user is told that the other photo was dropped.
4. **Given** a divider whose side(s) are themselves further subdivided, **When** the user deletes it, **Then** everything on both sides merges into one cell and all dividers inside it are removed. The cell keeps the first photo on the first side (top/left), or if that side has none, the first photo on the second side. The user is told how many dividers and photos were removed, and one undo restores all of them.
5. **Given** any change to layout, photos, photo position or style, **When** the user presses Ctrl/Cmd+Z or the Undo button, **Then** that change is reversed; **When** they press Ctrl/Cmd+Shift+Z or Redo, **Then** it is reapplied.
6. **Given** a continuous gesture (a divider drag, a photo pan, a pinch), **When** the user undoes, **Then** the whole gesture is reversed in one step, not pixel by pixel.

---

### User Story 5 - Preview the finished collage (Priority: P2)

After drawing a custom grid and uploading photos, the user opens a clean preview of the finished collage. Each photo is cropped to the exact shape of its own cell (its width, height, gap and rounded corners), so every column and row looks just like it will in the exported file.

**Why this priority**: With free-drawn grids, cells come in many different shapes. The editor view shows dividers, handles and hints, which make it hard to judge the final look. A true-to-export preview lets users check their work before exporting and go back to fix it.

**Independent Test**: Draw a custom grid with cells of different shapes (a tall narrow column, a wide short row, a small square), upload a photo into each, adjust one, and open Preview. Each photo fills only its own cell shape, and none of the editor controls are visible. Export, then compare: the file matches the preview.

**Acceptance Scenarios**:

1. **Given** a layout where at least one cell has a photo, **When** the user opens Preview, **Then** the collage shows without dividers, handles, selection outlines, mode hints or empty-cell prompts, exactly as the export will look.
2. **Given** cells of different shapes, **When** Preview is shown, **Then** each photo is cropped to its own cell's rectangle (including gap, padding and corner radius), keeps the position and zoom the user set, and never spills into neighbouring cells.
3. **Given** empty cells, **When** Preview is shown, **Then** they appear in the background color, as in the export.
4. **Given** Preview is open, **When** the user closes it (close button, Escape, or tapping back), **Then** they return to the editor with the layout, photos and mode unchanged.
5. **Given** Preview is open, **When** the user chooses Export from it, **Then** the export uses the same settings and matches what was previewed.
6. **Given** the last photo upload in the grid has just finished (every cell is filled), **When** it completes, **Then** the app offers a one-tap shortcut to Preview, without opening it automatically.

---

### User Story 6 - Style the collage (Priority: P3)

A user sets the gap between cells, the border and background color, cell corner radius, and outer padding.

**Why this priority**: It improves the look but is not needed to make a usable collage.

**Independent Test**: Set gap to 20px, radius to 16px, padding to 30px and color to white, then export. The file shows white gaps and padding, and rounded photos, in proportion to the preview.

**Acceptance Scenarios**:

1. **Given** the style panel, **When** the user sets the gap/border width (0–40px), **Then** the space between cells updates live.
2. **Given** the style panel, **When** the user picks a color, **Then** the gaps, padding and empty cells use that color.
3. **Given** the style panel, **When** the user sets corner radius or outer padding, **Then** the preview updates live.
4. **Given** any style settings, **When** the user exports, **Then** gap, padding and radius look the same in proportion to the canvas as in the preview (values are scaled from preview to export resolution).

---

### User Story 7 - Use on phones, tablets and with a keyboard (Priority: P3)

A user makes a whole collage on a phone with touch only, or on a desktop using the keyboard for the main actions.

**Why this priority**: Story-format collages are mostly made on phones, so this matters a lot for real use. It is a polish pass over features built in earlier stories.

**Independent Test**: On a phone-sized touch screen, choose a preset, draw a line, add photos from the photo library, pinch-zoom one, and export, without any mouse or keyboard.

**Acceptance Scenarios**:

1. **Given** a narrow (phone) screen, **When** the editor loads, **Then** the toolbar is at the top, the canvas fits the screen, and the style panel is a bottom sheet instead of a side panel.
2. **Given** a touch device, **When** the user draws lines, drags dividers, pans or pinches photos, **Then** each gesture works without the page scrolling or zooming by accident.
3. **Given** keyboard-only use, **When** the user presses Tab, **Then** focus moves through toolbar controls and cells with a clearly visible focus style, and Enter on an empty cell opens the file picker.
4. **Given** a screen reader, **When** the user moves through controls, **Then** every button and control has a meaningful label.

---

### Edge Cases

- **Very large photos** (for example 50 megapixels or more): the app scales them down to no more than what the export needs, so it does not run out of memory on phones. Export still works.
- **Unreadable or non-image file** (dropped or picked): the cell stays as it was and the user sees a short, friendly error.
- **Several files dropped on one cell**: only the first image is used.
- **Changing aspect ratio after placing photos**: the layout keeps its proportions, and each photo is re-fitted so it still covers its cell (it may be re-cropped).
- **Applying a preset over an existing layout with photos**: photos are placed into the new cells in reading order; any extra photos are dropped. This is one undoable step.
- **Clear in Custom mode**: removes all dividers, leaves one cell (keeping the first photo, if any), and can be undone.
- **Stroke too short** (a tap or tiny drag): no line is created; in Draw lines mode, a tap does not open the file picker.
- **Stroke starting or ending outside the canvas**: only the part over the canvas counts.
- **Stroke that crosses one cell several times** (for example a wavy line along an edge): each crossing that runs from edge to edge splits the cell again, so the cell can become more than two pieces.
- **Stroke that crosses itself**: rejected with the hint "Lines can't cross themselves".
- **Stroke that stays inside one cell and never reaches an edge or line**: nothing happens; the hint "Draw from edge to edge" appears.
- **Gap or padding so large that cells would vanish**: the style controls are limited so every cell stays visible.
- **Custom size out of range** (zero, negative, non-numeric or above the maximum): the input is rejected with a message, and the previous size is kept.
- **Export on a device that cannot produce an image that large**: the user sees a clear error with a suggestion to pick a smaller size. The app never downloads a blank or broken file without warning.
- **Photo replaced or removed**: its memory is released once no undo or redo step refers to it.

## Requirements *(mandatory)*

### Functional Requirements

**Privacy & platform**

- **FR-001**: The app MUST run entirely on the user's device. Photos, layouts and exported images MUST never be sent over the network, and the app MUST NOT include analytics or tracking.
- **FR-002**: The app MUST work without an account and MUST NOT require saving anything between sessions.
- **FR-003**: The app MUST be named "SplitFrame" in the page title and header.

**Canvas**

- **FR-004**: Users MUST be able to choose canvas shapes: 9:16 (1080×1920), 1:1 (1080×1080), 4:5 (1080×1350), 16:9 (1920×1080), and Custom width × height in pixels.
- **FR-005**: The editor MUST show a scaled preview that fits the screen, while all layout and style values are kept relative to the canvas so the export matches the preview at full resolution.

**Layout**

- **FR-006**: Cells from presets and from straight horizontal or vertical lines MUST be rectangles. Freehand lines MAY create cells of any shape, with straight, angled or curved sides. Lines never overlap each other inside a cell.
- **FR-007**: The layout MUST be kept as a hierarchy of splits, where each split divides one region into two, either at a relative position (0–1) for straight horizontal or vertical lines, or along a drawn path for freehand lines. Cell positions shown in the editor and used in the export MUST both come from this one layout description.
- **FR-008**: The app MUST offer layout presets: 2, 3 and 4 columns; 2 and 3 rows; 2×2 grid. Each creates equal-size cells.

**Custom drawing**

- **FR-009**: In Draw lines mode, a drag MUST create a line. If the stroke is almost straight and within a few degrees of horizontal or vertical, it MUST become an exact straight horizontal or vertical line. Otherwise the line MUST follow the stroke, smoothed to remove hand jitter.
- **FR-010**: The app MUST show a live preview of the line being drawn, in its final form (straightened or smoothed, trimmed and extended).
- **FR-011**: On release, the line MUST run from edge to edge of every cell it splits. Parts of the stroke beyond an edge or an existing line MUST be ignored, and a stroke end within about 16 screen pixels of an edge or line MUST be extended to it. Each cell the stroke crosses from edge to edge MUST be split along it (straight lines at the same coordinate); cells not crossed MUST stay unchanged.
- **FR-012**: While drawing a straight horizontal or vertical line, the line MUST snap to the canvas center, to thirds, and to existing parallel edges when within about 8 screen pixels, and MUST show a guide for the active snap.
- **FR-013**: The app MUST reject any split that would make a cell smaller than the minimum cell size, and any stroke that crosses itself or crosses no cell from edge to edge. It MUST show a visual warning with the reason while the stroke is invalid.
- **FR-014**: Entering Custom mode MUST keep the current layout. A "Clear" action MUST reset to one cell.
- **FR-015**: The app MUST clearly show which mode is active: "Draw lines" (drag creates lines) or "Arrange" (drag moves photos).

**Divider editing**

- **FR-016**: Straight horizontal or vertical dividers between rectangular regions MUST show a resize cursor on hover and MUST be draggable in both modes, changing the split position live. Freehand dividers MUST be selectable and removable but are not draggable.
- **FR-017**: Divider dragging MUST stop at the point where any affected cell would become smaller than the minimum cell size.
- **FR-018**: Users MUST be able to select a divider and remove it with Delete/Backspace or an on-screen × handle, merging the two sides. If both sides hold a photo, the first-side (top/left) photo MUST be kept and the user MUST be told the other was dropped.
- **FR-019**: Removing a divider whose sides contain more dividers MUST merge the whole region into one cell and remove every divider inside it. The cell MUST keep the first photo in reading order from the first side (top/left), or from the second side if the first has none. The app MUST tell the user how many dividers and photos were removed, and one undo step MUST restore them all.

**Photos in cells**

- **FR-020**: Clicking/tapping an empty cell (in Arrange mode), or pressing Enter on a focused empty cell (in either mode), MUST open a file picker that accepts images only.
- **FR-021**: Dropping an image file on a cell MUST place it in that cell.
- **FR-022**: Photos MUST fill their cell by default, with no empty space and no distortion (cover fit), centered. For a shaped cell, the photo MUST cover the cell's bounding box and be clipped to the cell's shape.
- **FR-023**: Users MUST be able to pan a photo by dragging and zoom it by wheel or pinch. The photo MUST always cover its cell, so zoom can never go below cover size.
- **FR-024**: Double-click/double-tap MUST reset a photo's position and zoom. Each filled cell MUST offer Replace, Remove and Reset position.
- **FR-025**: When a cell changes size (resize, split, aspect change), its photo MUST be adjusted so it still covers the cell.
- **FR-026**: Photos larger than the export needs MUST be scaled down when loaded, to keep memory use safe on phones.
- **FR-027**: When a photo is replaced or removed, the memory it used MUST be released as soon as no undo or redo step can bring it back.
- **FR-028**: Users SHOULD be able to drag a photo onto another cell to swap the two photos.

**Styling**

- **FR-029**: Users MUST be able to set: gap/border width (0–40 reference px, where the canvas short side is 1080 px), border/background color, cell corner radius, and outer canvas padding. All changes MUST show live. The gap MUST follow every line, including curved ones. Corner radius MUST be exact on rectangular cells and MAY be approximate on shaped cells.
- **FR-030**: Style values MUST be scaled in proportion when exporting, so the export matches the preview.

**Export**

- **FR-031**: Users MUST be able to export as PNG, or as JPG with a quality slider.
- **FR-032**: The export MUST be rendered at full target resolution using the same cell positions, gap, padding, radius, and each photo's position and zoom as the preview.
- **FR-033**: Empty cells MUST appear in the background color in the export.
- **FR-034**: The export MUST download straight to the device, named `splitframe-YYYYMMDD-HHmm.png` (or `.jpg`) using local time.
- **FR-035**: If export fails, the app MUST show a clear error and MUST NOT silently download a broken file.

**Final preview**

*(FR-041 to FR-045 were added after FR-036 to FR-040 were numbered, so their IDs are out of order. They are kept as they are because tasks refer to them.)*

- **FR-041**: Users MUST be able to open a Preview of the finished collage at any time from the toolbar. It MUST hide all editing controls (dividers, handles, selection, mode indicator, empty-cell prompts).
- **FR-042**: Preview MUST be drawn from the same layout, style and photo positions as the export. Each photo MUST be cropped to its own cell's shape (size, gap, padding, corner radius), so Preview and the exported file match.
- **FR-043**: Closing Preview MUST return to the editor with nothing changed. Preview MUST offer Export directly.
- **FR-044**: When an upload fills the last empty cell, the app MUST offer a shortcut to Preview without opening it automatically.
- **FR-045**: While a line is being drawn across a cell with a photo, the live preview MUST show how that photo will be cropped in its resulting cell.
- **FR-047**: Users MUST be able to start a new collage from the top bar. When the collage has any photo or line, the app MUST ask for confirmation first. Starting again clears photos and lines, keeps the canvas shape and style, and can be undone. While there is unsaved work, refreshing or closing the page MUST trigger the browser's leave-page warning.
- **FR-046**: When a freehand line splits a cell that holds a photo, the photo MUST stay in the larger of the two new cells. (For straight horizontal or vertical lines it stays in the top or left cell, as before.)

**History**

- **FR-036**: Every change to layout, photos, photo position/zoom, canvas shape and style MUST be undoable and redoable, through toolbar buttons and Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
- **FR-037**: A continuous gesture (drag, pinch, slider move) MUST count as one undo step.

**Interface, devices & accessibility**

- **FR-038**: The screen MUST be arranged as: a slim top bar (name, undo/redo, Preview, Export), the canvas filling the rest of the screen, and a floating dock at the bottom with Layout, Draw and Style. Layout, Style and Export open as panels: a floating side panel on wide screens and a bottom sheet on phones. The canvas MUST shrink to stay fully visible next to or above an open panel, and Draw mode MUST show a visible "Done" control so it can be left without a keyboard.
- **FR-039**: All pointer interactions MUST work the same with mouse, touch and pen. Touch gestures on the canvas MUST NOT scroll or zoom the page.
- **FR-040**: All controls MUST have accessible labels and a visible focus style. Cells MUST be reachable with the keyboard.

### Key Entities

- **Canvas**: The output frame. It has a shape (preset or custom), a target pixel size for export, and the style settings.
- **Layout**: A hierarchy that starts as one region. Each **Split** divides a region into two parts: either a straight split with a direction (horizontal/vertical) and a relative position (0–1), or a freehand split along a drawn path. Every region that is not split further is a **Cell**. Cell shapes are always calculated from this hierarchy, never stored separately.
- **Cell**: An area of the canvas, either a rectangle or a shape bounded by freehand lines. It is empty or holds one Photo.
- **Photo (cell image)**: A user-chosen image kept only in memory. It has its original size, a zoom level (never below cover) and which part of the photo is shown in its cell.
- **Style**: Gap/border width, border/background color, corner radius, outer padding.
- **Divider**: The visible line of a Split. Straight dividers can be dragged; all dividers can be removed.
- **History**: The list of past and undone editor states used for undo/redo.
- **Export settings**: Format (PNG/JPG), JPG quality, and the resulting filename.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can make a 3-photo Story collage from a preset and download it in under 60 seconds, without instructions.
- **SC-002**: A user can build a custom grid of at least 5 cells by drawing lines in under 30 seconds. 100% of accepted lines run edge to edge, and nearly straight horizontal or vertical strokes come out perfectly straight.
- **SC-003**: The exported image matches the editor preview: every cell edge, gap and photo crop lines up within 1% of the canvas size.
- **SC-004**: The exported file has exactly the chosen canvas pixel size in 100% of exports.
- **SC-005**: No photo or image data leaves the device: 0 network requests carry user content during a full session.
- **SC-006**: Exporting a 1080×1920 collage with 6 photos from a phone camera (12+ megapixels each) finishes in under 5 seconds on a typical mid-range phone, without crashing or reloading the page.
- **SC-007**: Dragging lines, dividers and photos follows the finger or pointer with no noticeable lag on a typical mid-range phone.
- **SC-008**: Every change can be undone and redone. After any sequence of up to 100 edits, undoing all of them returns the exact starting state.
- **SC-009**: The full flow (choose shape, choose or draw layout, add photos, adjust, export) can be completed with touch only on a phone, and the main actions (controls, opening cells, undo/redo, export) with keyboard only.
- **SC-010**: The Preview matches the exported file: every cell edge and photo crop lines up within 1% of the canvas size, and Preview opens in under 1 second for a 6-photo collage on a typical mid-range phone.
- **SC-011**: Drawing the reference sketch (7 strokes, including overshoots, three corner cuts and two L shapes) produces exactly 8 cells that together cover the canvas with no holes or overlaps.

## Assumptions

- **Target users**: people who make social-media collages (mainly Stories), on phones and desktops, with current evergreen browsers. Older browsers are not supported.
- **Minimum cell size**: a rectangular cell cannot be narrower or shorter than the larger of 5% of the canvas size on that axis or 40 pixels at export resolution. A shaped cell must have at least the area of a square with that side (using the canvas short side).
- **Straight or freehand**: a stroke counts as straight when it is within about 5° of horizontal or vertical and never strays more than about 3% of its length (at least 4 screen pixels) from a straight line.
- **Divider segments**: a line drawn across several cells creates one divider per crossed cell. These are separate dividers that can be removed one at a time (and dragged, if straight); straight ones start at the same coordinate and snap to each other.
- **Split and photos**: when a filled cell is split by a straight line, the photo stays in the first (top/left) new cell; when it is split by a freehand line, it stays in the larger new cell.
- **Presets over photos**: when a preset is applied to a layout that has photos, photos are moved into the new cells in reading order; any extras are dropped; the step can be undone.
- **Aspect changes**: changing canvas shape keeps relative split positions, and photos are re-fitted to cover their cells.
- **Style ranges**: gap 0–40 px, corner radius 0–100 px, outer padding 0–100 px (in reference pixels, where the canvas short side is 1080 px, scaled for the preview and the export), default color white, and defaults of gap 8 px, radius 0 px, padding 0 px.
- **JPG quality**: adjustable from 10% to 100%, default 92%.
- **Custom size**: each side from 100 to 8000 pixels.
- **Large photos**: photos are scaled down to fit the canvas size at the time they're added, with a minimum long side of 2048 px. If the canvas is later made much larger, those photos may look softer until they're added again.
- **Undo depth**: the last 100 changes can be undone.
- **Photo swap by drag**: nice to have; it can be left out of the first release.
- **Persistence**: nothing is saved between sessions. Saving only the layout (never photos) on the device may come later.
- **Out of scope**: dragging or reshaping a freehand line after it is drawn (delete and redraw instead), lines that cross themselves, closed loops, text, stickers, filters, accounts, cloud saving, share links.
- **Delivery order**: the project brief asks for delivery in phases with a review after each: model and presets, then photos, custom drawing, divider editing and undo, styling, export, preview, and finally mobile and accessibility polish.
- **Technical direction**: the brief also names a technology stack, a project structure and a testing approach. These are kept for the planning phase and are not part of this specification.
