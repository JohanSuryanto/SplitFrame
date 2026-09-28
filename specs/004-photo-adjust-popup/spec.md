# Feature Specification: Photo Adjust Popup

**Feature Branch**: `004-photo-adjust-popup`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Photo adjust popup: after picking a photo from the device for a cell, open a popup that shows the photo inside that cell's exact shape (rounded corners and freehand shapes included; the part outside faintly visible). In the popup the user can drag to move in any direction, pinch/scroll to zoom, use a zoom slider with −/+ buttons, and Reset. Done applies it to the cell as one undo step; Cancel on a new photo means it is not added. The same popup opens from a new "Adjust…" item in the photo's ⋯ menu for photos already placed. Skip the popup for sample images, multi-photo drops and "Fill empty cells with samples". Zoom may go below "fill" so the whole photo can be seen; gaps show the collage background color and are included in the export; zoom snaps back to exactly fill when close; double-tap/Reset still returns to fill. Quick in-cell drag/pinch remains."

## Overview

Today a photo always fills its cell exactly, so it can only be moved along the direction where it overflows. For example, a tall photo in its cell can move up and down but gets stuck left and right until the user zooms in. Zooming is done by pinch or scroll wheel, which many people don't discover. Small cells on a phone are also cramped for fine adjustment.

This feature adds a large **Adjust photo** popup that shows the photo inside the cell's exact shape, with clear controls for moving and zooming and a **Done** button. It opens right after a photo is picked from the device, and any time later from the photo's ⋯ menu. It also lets users zoom out past "fill" to fit more of the photo, with the leftover space shown in the collage background color.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Frame a new photo before it goes into the cell (Priority: P1)

A user taps an empty cell and chooses a photo from their device. Instead of dropping straight into the cell, the photo opens in the Adjust popup, shown inside the cell's exact shape and as large as the screen allows. They drag it to put the right part in view, zoom with pinch, the scroll wheel or the slider, and tap **Done**. The cell now shows exactly that framing.

**Why this priority**: This is what the user asked for. It removes the "stuck" feeling and the cramped small-cell adjusting at the moment framing matters most.

**Independent Test**: On a phone, make a 3-column 9:16 layout. Tap the left cell and choose a landscape photo. The Adjust popup opens showing a tall, narrow frame. Drag the photo left and right, zoom in with the slider, then tap Done. The cell shows the same framing, and one Undo removes the photo again.

**Acceptance Scenarios**:

1. **Given** an empty cell, **When** the user picks a photo from their device (via the "Add a photo" chooser, a click, or dropping a file on the cell), **Then** the Adjust popup opens with that photo, framed to fill the cell and centered, before anything changes on the canvas.
2. **Given** the Adjust popup is open, **When** the user looks at it, **Then** they see the photo inside the cell's exact shape (the same proportions, rounded corners and freehand edges as in the collage), with the part of the photo outside the shape faintly visible around it.
3. **Given** the popup is open, **When** the user drags the photo, **Then** it follows the finger or pointer in any direction the rules below allow.
4. **Given** the popup is open, **When** the user pinches, scrolls the wheel, drags the zoom slider, or presses − or +, **Then** the photo zooms around the pinch point, the pointer, or the center of the frame.
5. **Given** the user has adjusted the photo, **When** they tap **Done**, **Then** the photo appears in the cell with exactly that framing, and the whole add counts as one step for Undo.
6. **Given** the popup was opened for a new photo, **When** the user taps **Cancel** or presses Escape, **Then** the popup closes and the cell stays empty (or keeps its previous photo when replacing).
7. **Given** a filled cell, **When** the user chooses **Replace** and picks a new photo, **Then** the popup opens with the new photo. Done swaps it in as one Undo step; Cancel keeps the old photo unchanged.

---

### User Story 2 - Zoom out to fit more of the photo (Priority: P1)

A user wants the whole photo visible in a narrow cell, even if that leaves some empty space. They zoom out below "fill". The photo shrinks inside the frame, and the uncovered area shows the collage background color. When they zoom back in near the "fill" size, it snaps to exactly fill so a clean edge-to-edge result is easy.

**Why this priority**: Without it, the popup would only make the current rule easier to use. The user explicitly accepted gaps, and they are needed to show a whole photo in a very different-shaped cell.

**Independent Test**: In the popup, zoom a landscape photo in a tall cell all the way out. The whole photo is visible, centered, with background-colored space above and below. Drag it up and down inside the frame. Tap Done, then export. The file shows the same gaps in the background color. Reopen Adjust and zoom in slowly: at the "fill" size the zoom settles exactly there.

**Acceptance Scenarios**:

1. **Given** the popup is open, **When** the user zooms out, **Then** zoom can go down to the size where the whole photo is visible in the cell ("fit"), and no further.
2. **Given** the photo is smaller than the cell in a direction, **When** the user drags it that way, **Then** it moves freely but always stays fully inside the cell in that direction. In a direction where it is still larger than the cell, it keeps covering the cell, as today.
3. **Given** the photo is zoomed below fill, **When** the user looks at the frame, **Preview**, or the exported or shared image, **Then** the uncovered area shows the collage's background color, the same in all of them.
4. **Given** the user zooms toward the fill size from either side, **When** the zoom comes within a small snapping range of exactly filling, **Then** it snaps to exactly fill, and the slider shows a clear "fill" mark.
5. **Given** any zoom and position, **When** the user taps **Reset** in the popup, or double-taps or double-clicks the photo in the popup or in the cell, **Then** the photo returns to exactly filling the cell, centered.

---

### User Story 3 - Adjust a photo that is already placed (Priority: P2)

A user changes the layout later: they drag a divider or switch the canvas shape, and a photo's crop now looks wrong. They open the photo's ⋯ menu, choose **Adjust…**, fix the framing in the popup and tap Done.

**Why this priority**: Cells change shape after photos are placed, so framing often needs fixing later. It reuses the same popup as Stories 1–2.

**Independent Test**: Place a photo, drag a divider to make its cell much narrower, open ⋯ → Adjust…, move the photo so the subject is centered, and tap Done. The cell updates and one Undo restores the previous framing.

**Acceptance Scenarios**:

1. **Given** a filled cell, **When** the user opens its ⋯ menu, **Then** it offers **Adjust…** alongside Replace, Reset position and Remove.
2. **Given** the user chooses Adjust…, **When** the popup opens, **Then** it shows the photo with its current framing, including any zoom below fill.
3. **Given** the popup was opened with Adjust…, **When** the user taps Done, **Then** the new framing is applied as one Undo step; **When** they tap Cancel, **Then** nothing changes.

---

### User Story 4 - Quick adjustments in the cell still work (Priority: P3)

Users who already drag and pinch photos directly in the cell can keep doing so. That in-cell adjusting follows the same zoom range and snapping rules as the popup.

**Why this priority**: It protects existing behavior. Nothing new is needed beyond applying the new zoom rules.

**Independent Test**: Without opening the popup, pinch a photo in its cell below fill. Background-colored space appears, and it snaps to fill when pinched back. Double-tap resets it.

**Acceptance Scenarios**:

1. **Given** a filled cell, **When** the user drags or pinches the photo directly in the cell, **Then** it moves and zooms immediately, with the same limits, gap behavior and snapping as in the popup.
2. **Given** a filled cell, **When** the user double-taps or double-clicks it, **Then** the photo resets to exactly fill, as today.

---

### Edge Cases

- **Sample images**: choosing a sample in the "Add a photo" chooser, "Try sample photos", "Fill empty cells with samples" and "Use a sample…" put the sample in straight away with the default fill, without the popup. Adjust… is available afterwards.
- **Several files dropped on one cell**: as today, only the first image is used, and it opens in the popup like any single picked photo.
- **Unreadable or non-image file**: the popup doesn't open; the existing friendly error is shown and the cell is unchanged.
- **Freehand-shaped cells**: the popup shows the true shape. The "fits inside the cell" rules use the cell's bounding rectangle, the same box the photo is framed against today.
- **Very small cells**: the popup always shows the frame large (it fits the screen, not the cell's on-canvas size), so tiny cells are easy to adjust.
- **Cell changes shape after Done**: as today, the photo keeps its focus point and zoom relative to the cell. If a zoom below fill would leave the photo outside the new cell, it is pulled back so it stays inside.
- **The layout changes while the popup is open**: not possible, because the popup is modal. The canvas behind it can't be edited until it closes.
- **Watermark and Export**: the popup doesn't show the watermark; it's only about the photo.
- **Rotation of a phone while the popup is open**: the frame resizes to the new screen and keeps the same framing.
- **Keyboard users**: arrow keys move the photo, + and − zoom, 0 resets, Enter is Done and Escape is Cancel.

## Requirements *(mandatory)*

### Functional Requirements

**When the popup opens**

- **FR-301**: Picking a photo from the device for a cell, whether through the "Add a photo" chooser, a click on an empty cell, dropping a file on a cell, or Replace, MUST open the Adjust popup with that photo before the canvas changes.
- **FR-302**: Every filled cell's ⋯ menu MUST offer **Adjust…**, which opens the popup with the photo's current framing.
- **FR-303**: Sample images, "Try sample photos", "Fill empty cells with samples" and "Use a sample…" MUST NOT open the popup. Samples are placed with the default fill.

**What the popup shows**

- **FR-304**: The popup MUST show the photo inside the cell's exact shape (proportions, corner radius and freehand edges), as large as the screen allows while leaving room for the controls.
- **FR-305**: The part of the photo outside the cell shape MUST stay faintly visible (dimmed) around the frame.
- **FR-306**: Areas of the frame not covered by the photo MUST show the collage background color.
- **FR-307**: The popup MUST NOT show dividers, other cells, the watermark or any editing handles.

**Controls**

- **FR-308**: Users MUST be able to move the photo by dragging, and with arrow keys.
- **FR-309**: Users MUST be able to zoom by pinch, by scroll wheel, with a zoom slider, and with − and + buttons and keys. Pinch and wheel zoom around the pinch point or pointer; the slider and buttons zoom around the center of the frame.
- **FR-310**: The zoom slider MUST show a visible mark at the "fill" size.
- **FR-311**: **Reset** (button, the 0 key, or double-tap/double-click on the photo) MUST return the photo to exactly fill the cell, centered.
- **FR-312**: **Done** (button or Enter) MUST apply the framing to the cell and close the popup. For a new or replaced photo, adding the photo and its framing MUST be a single Undo step. For Adjust…, the framing change MUST be a single Undo step.
- **FR-313**: **Cancel** (button or Escape) MUST close the popup with no change to the collage. A new photo isn't added; a replaced photo stays as it was. A tap outside the popup MUST NOT close it, so an accidental tap can't throw away the framing.

**Zoom and position rules (popup and in-cell alike)**

- **FR-314**: Zoom MUST range from **fit** (the whole photo visible in the cell's bounding rectangle) up to the existing maximum zoom (8× the fill size).
- **FR-315**: In each direction (horizontal and vertical), if the photo is larger than the cell it MUST keep covering the cell (no gap on that axis). If it is smaller, it MAY move freely but MUST stay fully inside the cell on that axis.
- **FR-316**: When the zoom comes within ±5% of the fill size, it MUST snap to exactly fill.
- **FR-317**: Gaps left by a zoom below fill MUST show the collage background color on the canvas, in Preview, and in exported and shared images, identically (base spec FR-032, FR-042; feature 002 FR-102).
- **FR-318**: Dragging and pinching photos directly in their cell MUST keep working, with the same rules as FR-314 to FR-317. Double-tap/double-click in a cell MUST still reset to fill.
- **FR-319**: The base-spec rule "The photo MUST always cover its cell, so zoom can never go below cover size" (FR-023) is replaced by FR-314 to FR-317. Existing photos keep their current framing.

**Accessibility and devices**

- **FR-320**: The popup MUST work with touch only, mouse only, and keyboard only. It MUST trap focus while open and return focus to the cell when closed. The slider and buttons MUST have clear labels ("Zoom", "Zoom out", "Zoom in", "Reset", "Done", "Cancel").
- **FR-321**: The popup MUST fit on a phone screen in both portrait and landscape, with the frame and all controls visible without scrolling.

### Key Entities

- **Photo framing**: the existing per-photo zoom and focus point. Zoom's lower limit changes from "fill" to "fit"; values below fill are new.
- **Adjust session**: a temporary copy of a photo's framing while the popup is open, for either a new or replacement photo or an existing one. It is written to the collage only on Done, as one Undo step, and discarded on Cancel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-301**: A photo that exactly fills a cell's width (so today it can't move sideways) can be moved left and right in the popup within 10 seconds, using only the zoom slider or buttons and dragging, with no pinch or wheel needed.
- **SC-302**: In testing with at least 5 people on phones, at least 4 frame a photo the way they want and tap Done on their first try without help, and at least 4 rate the popup easier than adjusting in the cell.
- **SC-303**: Framing done in the popup matches the cell, Preview and the exported image within 1% of the canvas size in 100% of checks.
- **SC-304**: The popup opens within 0.5 seconds of picking a 12-megapixel photo on a typical mid-range phone, and dragging and zooming follow the finger smoothly (no visible lag).
- **SC-305**: Cancel leaves the collage exactly as before in 100% of checks: no photo is added and Undo history is unchanged.
- **SC-306**: Zooming back toward fill lands on exactly fill (no thin gap or overflow at the edges) in 100% of attempts that end within the snapping range.

## Assumptions

- **Opens automatically** for photos picked from the device (the user's choice), and on request through Adjust… for placed photos.
- **Samples skip the popup** so trying layouts stays instant. The request's "multi-photo drops" maps to the base rule that only the first dropped file is used, which does open the popup.
- **Gaps are allowed** and use the collage background color, not blur or transparency. PNG exports are not given transparent gaps.
- **Snapping range** of ±5% around fill is a starting value, to be tuned in testing.
- **No rotation or flipping** of photos in this feature.
- **Depends on** the base editor's framing model and single renderer for canvas, Preview and export (base spec FR-023–FR-026, FR-032, FR-042), and on Share (002) producing the same image as Download.
