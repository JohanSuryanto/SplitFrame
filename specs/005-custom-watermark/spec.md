# Feature Specification: Custom Watermark

**Feature Branch**: `005-custom-watermark`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Custom watermark for SplitFrame. Users can add their own text watermark on top of their image (single photo via a 1-cell canvas, or a collage). Primary use case: a user uploads a photo of their identity card (KTP/ID/passport) and stamps it with a watermark such as "For verification by Bank X only - 2026-11-06" before sending it to someone, so a leaked copy can't be reused elsewhere. Requirements: user types the watermark text; drags it to move it freely anywhere on the canvas (mouse, touch, pen); adjusts opacity; picks the color; adjusts size and rotation. Suggested additions: a "tile/repeat" mode that repeats the text diagonally across the whole image so it can't be cropped or cloned out (the standard for ID card watermarking); a quick "Add today's date" option; the existing "SplitFrame · splitframe.johansuryanto.dev" credit stays a separate on/off toggle, independent of the custom watermark. Must work fully on phones and stay lightweight (no new dependencies). Everything stays on-device: no upload, no network, matching SplitFrame's existing privacy guarantee (CSP connect-src 'none') - especially important for identity documents. Watermark appears in preview, PNG/JPG download and Share, at full export resolution, and is part of undo/redo. Out of scope for this feature: logo/image watermarks and drawn signatures (planned as later features that should reuse the same placement/opacity controls)."

## Overview

People are often asked to send a photo of their identity card (KTP, ID card, passport, driver's licence) to a bank, landlord, employer or online shop. Once sent, that photo can leak and be reused for fraud. The common defence is to stamp the copy with a watermark that names who it is for and when, for example "For verification by Bank X only · 06-11-2026". A leaked copy is then obviously not valid for anything else.

SplitFrame already loads photos on the device, frames them, and exports them without anything leaving the device. That makes it a safe place for this. This feature adds a **Watermark** panel where the user types their own text, then sets its color, opacity, size and rotation and drags it anywhere on the image. A **Repeat** mode covers the whole image with the text in diagonal rows, so it can't simply be cropped or painted out.

The existing "SplitFrame · splitframe.johansuryanto.dev" credit (feature 003) stays as it is, a separate switch in Export. It is renamed **SplitFrame credit** so the two are not confused.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stamp an ID card photo with my own text (Priority: P1)

A user picks a 1-cell layout and adds a photo of their ID card. They open **Watermark** in the dock, type "For verification by Bank X only", and the text appears on the image straight away. They drag it over the card, make it a bit bigger, tilt it, pick red, and lower the opacity so the card details stay readable. They download the image and send it.

**Why this priority**: This is the feature. Without own text that can be placed, styled and exported, nothing else matters.

**Independent Test**: On a phone, choose a 1-cell 16:9 canvas, add a photo, open Watermark, type a text, drag it to the top-left, set size, rotation, color and opacity, then download. The file shows the text exactly where and how it looked on the canvas, at full resolution.

**Acceptance Scenarios**:

1. **Given** the Watermark panel is open and the text box is empty, **When** the user types text, **Then** the text appears on the canvas, centered, with the default style (white, 50% opacity, no rotation).
2. **Given** a watermark is on the canvas and the Watermark panel is open, **When** the user drags the text with a finger, mouse or pen, **Then** it follows the pointer smoothly and stays where it is released.
3. **Given** a watermark is on the canvas, **When** the user changes size, rotation, opacity or color in the panel, **Then** the canvas updates at once.
4. **Given** a watermark is set, **When** the user opens Preview, downloads (PNG or JPG) or shares, **Then** all three show the watermark in the same place, size, angle, color and opacity as the canvas.
5. **Given** a watermark is set, **When** the user presses Undo, **Then** the last watermark change (text edit, move, or style change) is undone; Redo brings it back.
6. **Given** a watermark is set, **When** the user clears the text box, **Then** the watermark disappears from the canvas and from exports.

---

### User Story 2 - Cover the whole image with repeating text (Priority: P1)

A user wants their ID copy to be hard to misuse. In the Watermark panel they switch **Repeat** on. The text now covers the whole image in diagonal rows. They still control size, rotation, color and opacity, and dragging shifts the whole pattern.

**Why this priority**: A single small stamp can be cropped or painted out in seconds. Repeating text across the image is the standard advice for ID copies, so the main use case is weak without it.

**Independent Test**: With a watermark set, switch Repeat on. The text covers the entire image, including corners, in evenly spaced rotated rows. Crop any quarter of the exported image: the text is still visible in it.

**Acceptance Scenarios**:

1. **Given** a watermark is set, **When** the user switches Repeat on, **Then** the text is repeated in evenly spaced rows across the whole image, rotated at −30° by default, with no empty corner larger than one repeat of the text.
2. **Given** Repeat is on, **When** the user changes size, rotation, opacity or color, **Then** every copy of the text changes together.
3. **Given** Repeat is on, **When** the user drags on the canvas, **Then** the whole pattern shifts with the pointer.
4. **Given** Repeat is on, **When** the user switches it off, **Then** a single watermark returns at its previous position and rotation.

---

### User Story 3 - Add today's date in one tap (Priority: P2)

A user taps **Add date** in the Watermark panel, and today's date is added to the end of their text (for example "For verification by Bank X only · 06-11-2026").

**Why this priority**: A date makes an old leaked copy easy to spot, and typing it on a phone is fiddly. Nice, but the feature works without it.

**Independent Test**: Type "For Bank X only", tap Add date. The text becomes "For Bank X only · " followed by today's date in the device's local format. Undo removes the date.

**Acceptance Scenarios**:

1. **Given** the text box has text, **When** the user taps Add date, **Then** " · " and today's date are appended.
2. **Given** the text box is empty, **When** the user taps Add date, **Then** the text becomes today's date alone.
3. **Given** the date was added, **When** the user edits the text, **Then** the date is ordinary text they can change or delete.

---

### User Story 4 - Choose credit and watermark separately (Priority: P2)

A user adds their own watermark but doesn't want the SplitFrame credit on an ID copy. In Export they switch **SplitFrame credit** off. Their own watermark stays.

**Why this priority**: The user asked for the two to be independent. A SplitFrame ad on an ID document looks odd.

**Independent Test**: Set a custom watermark, switch the SplitFrame credit off in Export, download. The file has the custom watermark and no credit. Switch the credit on: both appear.

**Acceptance Scenarios**:

1. **Given** a custom watermark is set, **When** the user switches the SplitFrame credit off, **Then** the export has the custom watermark only.
2. **Given** no custom watermark, **When** the SplitFrame credit is on, **Then** the export looks exactly as it does today (feature 003).
3. **Given** both are on, **When** they overlap, **Then** both are drawn; the credit is drawn on top.

---

### Edge Cases

- **Long text**: text is limited to 100 characters. A single watermark wider than the canvas at the chosen size simply runs past the edges and is cropped in the export, exactly as the canvas shows it.
- **Dragging off the image**: a single watermark's center can't leave the canvas, so the user can always grab it again.
- **Changing canvas shape or size**: position and size are kept relative to the canvas (position as a fraction of width and height, size as a fraction of the short side), so the watermark stays in the same visual spot after switching shape or resolution.
- **Gestures**: while the Watermark panel is open, dragging on the canvas moves the watermark, not the photo or the grid lines. With the panel closed the watermark is shown but ignores input, so editing photos and lines works as before.
- **Tiny canvases**: the watermark is drawn at whatever size the user chose; it is never silently left out (unlike the credit's 10 px rule), because the user can see it on the canvas.
- **Readability**: on a busy photo, a low-opacity color can be hard to read. That's the user's choice; the canvas always shows the true result before export.
- **Empty cells and padding**: the watermark is drawn over everything, photos, gaps, padding and background alike.
- **Emoji and non-Latin text**: any text the device can display is drawn in the export the same as on the canvas.

## Requirements *(mandatory)*

### Functional Requirements

**Watermark panel and text**

- **FR-501**: The dock MUST have a **Watermark** item that opens a Watermark panel, next to Layout and Style.
- **FR-502**: The panel MUST contain a single-line text box (up to 100 characters). Empty text means no watermark.
- **FR-503**: The panel MUST have an **Add date** button that appends " · " and today's date in the device's local short date format (just the date if the box is empty).

**Look and placement**

- **FR-504**: Users MUST be able to set the watermark's **color** from a small set of presets (white, black, red, gray) or any color via a color picker.
- **FR-505**: Users MUST be able to set **opacity** from 10% to 100% (default 50%).
- **FR-506**: Users MUST be able to set **size** (text height) from 2% to 20% of the canvas's short side (default 6%).
- **FR-507**: Users MUST be able to set **rotation** from −90° to 90° (default 0° for a single watermark, −30° when Repeat is first switched on). Rotation snaps to 0° within ±3°.
- **FR-508**: Users MUST be able to move a single watermark freely by dragging it on the canvas with touch, mouse or pen while the Watermark panel is open. Its center MUST stay inside the canvas.
- **FR-509**: Users MUST be able to switch **Repeat** on to tile the text across the whole canvas in evenly spaced, rotated rows, with gaps of about one text height between rows and about two text heights between copies. Dragging then shifts the pattern.
- **FR-510**: Every panel control MUST be usable with touch, mouse and keyboard and labelled for screen readers. The watermark's position MUST also be adjustable without dragging (for example arrow keys when the canvas watermark has focus, or a "Center" button), so keyboard users can place it.

**Display and export**

- **FR-511**: When text is set, the watermark MUST show on the editing canvas at all times, exactly as it will appear in the file. It reacts to input only while the Watermark panel is open.
- **FR-512**: Preview, PNG download, JPG download and Share MUST include the watermark, drawn at full export resolution, matching the canvas in position, size, angle, color and opacity (within 1% of the canvas size).
- **FR-513**: The watermark MUST be drawn over the whole collage (photos, gaps, padding and background), and under the SplitFrame credit.

**History and session**

- **FR-514**: Watermark changes (text, move, color, opacity, size, rotation, Repeat) MUST be part of undo/redo. A drag, or a slider drag, counts as one step.
- **FR-515**: The watermark MUST last for the session only and MUST NOT be remembered after a reload, in line with SplitFrame's rule that nothing is saved between sessions.

**SplitFrame credit**

- **FR-516**: The existing Watermark switch in Export and Preview (feature 003) MUST be relabelled **SplitFrame credit**, and MUST work independently of the custom watermark. Its behaviour is otherwise unchanged.

**Privacy and weight**

- **FR-517**: Text entry, drawing and export MUST happen entirely on the device with no network access, keeping the base privacy rule and the existing content security policy.
- **FR-518**: The feature MUST NOT add any new third-party dependency and MUST work fully on current phone browsers (iOS Safari, Android Chrome).

### Key Entities

- **Custom watermark**: part of the collage document (so it is undoable). Holds text, color, opacity, size (fraction of the short side), rotation, position (fractions of canvas width and height) and Repeat on/off. Empty text means none.
- **SplitFrame credit setting**: the existing on/off export setting from feature 003, renamed. Not part of the document or undo history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-501**: A first-time user on a phone can add a photo, type a watermark, place and style it, and download the image in under 60 seconds.
- **SC-502**: For the same document, the watermark in Preview, Download and Share matches the canvas within 1% of the canvas size in position and size, and exactly in angle, color and opacity.
- **SC-503**: With Repeat on, every quarter of the exported image contains at least one full copy of the text.
- **SC-504**: Dragging the watermark on a mid-range phone feels immediate: no visible lag between finger and text.
- **SC-505**: The production site still makes no network request carrying image or watermark data (unchanged from today's zero).
- **SC-506**: In a check with at least 5 people, at least 4 can stamp an ID-card photo with a repeated, dated watermark without help.

## Assumptions

- **Single photo = 1-cell canvas**: there is no separate "single photo" mode. A 1-cell layout already gives one photo in, one image out. The existing canvas sizes, including custom up to 8000 px, cover ID-card proportions.
- **One watermark**: one custom watermark (single or repeated) per image. Several separate text boxes is out of scope.
- **Single line**: no line breaks. Users who need two lines can use Repeat or two short phrases separated by " · ".
- **Font**: the app's existing font, bold. No font picker.
- **Date format**: the device's local short date format (for example 06/11/2026 or 11/6/2026), so it matches what the user expects where they live.
- **Not image-proof**: a visible watermark discourages and exposes misuse; it doesn't make editing impossible. The app doesn't claim otherwise.
- **Later features**: logo/image watermarks and drawn signatures will reuse the same panel controls (position, size, rotation, opacity, Repeat). They are not part of this feature.
- **Depends on** the shared export renderer (base spec FR-032, FR-042), Share (002) and the export credit (003), which together keep Preview, Download and Share identical.
