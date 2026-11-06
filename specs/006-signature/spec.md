# Feature Specification: Signature

**Feature Branch**: `006-signature`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Signature for SplitFrame (feature 006). Users can add their own signature on top of their image, as a separate layer from the custom text watermark (feature 005), so both can appear on one image (for example a tiled "For Bank X only · date" watermark plus a signature in a corner). Two ways to create the signature: (1) Draw it in a popup signature pad with finger, mouse or pen (reusing SplitFrame's existing stroke input), with Clear and Done; (2) Upload a photo of a signature written on paper, where the paper background is made transparent automatically so only the ink stays (with a simple threshold/sensitivity control). Once created, the signature is placed on the canvas and the user can drag it anywhere, and set size, rotation, opacity and ink color, reusing the same placement controls and drag/keyboard behaviour as the text watermark. The signature can be redrawn, replaced or removed. It appears in the editor, Preview, PNG/JPG Download and Share at full export resolution, and every change is part of undo/redo. Privacy: everything stays on the device, no upload, no network (CSP connect-src 'none'), and the signature is kept for the session only, never saved between visits - important because a signature is sensitive. Must work fully on phones and stay lightweight (no new dependencies). The upload path effectively also enables image/logo marks; that is a welcome side effect but the feature is framed around signatures. Out of scope: saving signatures between visits, several signatures on one image, signing PDFs, tiling/Repeat for the signature."

## Overview

Feature 005 lets users stamp their own text on an image, mainly to protect ID-card copies. People sending documents are often also asked to sign them, for example a signed copy of an ID card ("I hand this over to Bank X for account opening only"), a signed photo of a form, or a signed artwork.

This feature adds a **signature** on top of the image, separate from the text watermark, so an image can carry both. Users either **draw** their signature with a finger, mouse or pen, or **upload a photo** of a signature written on paper. For an uploaded photo, the paper is removed automatically so only the ink stays. The signature is then placed like the watermark: drag it anywhere, and set its size, rotation, opacity and ink color.

A signature is sensitive, so it never leaves the device and is forgotten when the page is closed, the same as everything else in SplitFrame.

Uploading a photo also makes it possible to place a small logo. That isn't the goal of this feature, but it comes along at no extra cost.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw my signature on the image (Priority: P1)

A user has stamped their ID-card photo with a watermark and now wants to sign it. In the Watermark panel they switch to **Signature** and tap **Draw signature**. A large pad opens. They sign with a finger, and the line follows smoothly. They tap **Done**. The signature appears on the image near the bottom-right corner in dark ink. They drag it to the right spot, make it a bit smaller, and download the image.

**Why this priority**: Drawing works on any device without paper, a camera or a scanner. It's the quickest path, and it delivers the feature on its own.

**Independent Test**: On a phone, open a 1-cell canvas with a photo, open Watermark → Signature → Draw signature. Sign, tap Done, drag the signature to the bottom-left, change size, rotation, opacity and color, then download. The file shows the signature exactly as on the canvas, with smooth, sharp lines at full resolution.

**Acceptance Scenarios**:

1. **Given** no signature yet, **When** the user taps Draw signature, **Then** a pad opens that fills most of the screen, with a signature line, **Undo stroke**, **Clear**, **Cancel** and **Done** (Done is disabled until something is drawn).
2. **Given** the pad is open, **When** the user draws with a finger, mouse or pen, **Then** the line follows the pointer without visible lag and looks smooth, not jagged.
3. **Given** the user drew several strokes, **When** they tap Undo stroke, **Then** the last stroke disappears; **When** they tap Clear, **Then** all strokes disappear.
4. **Given** the user taps Done, **When** the pad closes, **Then** the signature appears on the canvas near the bottom-right, in dark ink (#111111) at 100% opacity, sized to about a third of the canvas's short side, and this counts as one undo step.
5. **Given** a signature is placed and the Signature tab is open, **When** the user drags on the canvas, **Then** the signature moves (not the text watermark), and one drag is one undo step.
6. **Given** a signature is placed, **When** the user changes size, rotation, opacity or ink color, **Then** the canvas updates at once, and each change can be undone.
7. **Given** a signature is placed, **When** the user opens Preview, downloads or shares, **Then** the signature appears there exactly as on the canvas, with lines as sharp as the export resolution allows.
8. **Given** the pad is open, **When** the user taps Cancel or presses Escape, **Then** nothing changes on the image.

---

### User Story 2 - Use a photo of my real signature (Priority: P1)

A user prefers their real pen signature. They sign a piece of white paper, take a photo of it, and in the Signature tab tap **Upload signature**. A popup shows the photo with the paper already removed, so only the ink remains, on a checkerboard background. They nudge a **Sensitivity** slider until the faint paper shadows are gone but the thin pen lines stay, then tap **Done**. The signature is placed on the image like a drawn one.

**Why this priority**: Many people find a finger-drawn signature looks nothing like their real one. For signing documents, the real signature matters, so this ships with drawing.

**Independent Test**: Photograph a signature in blue pen on white paper under normal indoor light. Upload it. Without touching the slider, the paper is gone and the ink is kept. Move the slider both ways and see more or less of the paper removed. Tap Done: the signature appears on the canvas, cropped tightly to the ink, and can be recolored to black.

**Acceptance Scenarios**:

1. **Given** the Signature tab is open, **When** the user taps Upload signature and picks a photo, **Then** a popup shows the result with the light background removed automatically and the ink kept, over a checkerboard so the user can see what is transparent.
2. **Given** the upload popup is open, **When** the user moves the Sensitivity slider, **Then** the preview updates at once to remove more or less of the background.
3. **Given** the result looks right, **When** the user taps Done, **Then** the signature is cropped to the ink with a small margin and placed on the canvas the same way as a drawn signature (one undo step).
4. **Given** an uploaded signature is placed, **When** the user picks an ink color, **Then** all the kept ink takes that color, so a blue-pen signature can become black.
5. **Given** the upload popup is open, **When** the user taps **Keep original colors**, **Then** the kept parts keep their own colors instead of being recolored (useful for a logo), and the ink color control is hidden while this is on.
6. **Given** the user picks a file that isn't an image or can't be read, **When** it fails to load, **Then** they see the same message SplitFrame shows for photos today, and nothing changes.
7. **Given** the photo has almost no dark marks (for example a blank page), **When** the background is removed, **Then** the popup says "No signature found — try a higher sensitivity or a clearer photo", and Done stays disabled.

---

### User Story 3 - Change or remove the signature (Priority: P2)

A user wants to sign again because the first try was messy, or wants the image without a signature. In the Signature tab they tap **Redraw** (or **Replace**) to make a new signature, or **Remove** to delete it. The new signature keeps the old one's position, size, rotation and opacity.

**Why this priority**: Without it, a bad first signature means starting over. It's useful, but the feature works without it because Undo can also take the signature off.

**Independent Test**: Place a signature, move it to the top-left and make it larger. Tap Redraw, sign again, Done: the new signature appears at the top-left at the same size. Tap Remove: it's gone. Undo brings it back.

**Acceptance Scenarios**:

1. **Given** a signature is placed, **When** the user redraws or uploads a new one and taps Done, **Then** the new signature replaces the old one and keeps its position, size, rotation, opacity and ink color, as one undo step.
2. **Given** a signature is placed, **When** the user taps Remove, **Then** it disappears from the canvas and from exports, and Undo restores it.

---

### User Story 4 - Watermark and signature together (Priority: P2)

A user has a tiled "For Bank X only · 06/11/2026" watermark and adds a signature in a corner. Both are on the canvas and in the export. Switching between the **Text** and **Signature** tabs decides which one a drag moves.

**Why this priority**: The user asked for the two to be separate layers that can be combined. This mostly falls out of US1, but the drag target and the drawing order need defining.

**Independent Test**: Set a Repeat text watermark and a signature. In the Text tab, dragging moves the pattern; in the Signature tab, dragging moves the signature. Download: both appear, with the signature drawn over the text watermark and the SplitFrame credit (if on) over both.

**Acceptance Scenarios**:

1. **Given** both a text watermark and a signature, **When** the image is exported, **Then** the order from bottom to top is: collage, text watermark, signature, SplitFrame credit.
2. **Given** both exist, **When** the Text tab is selected, **Then** a drag moves the text watermark; **When** the Signature tab is selected, **Then** a drag moves the signature.
3. **Given** the Watermark panel is closed, **When** the user works on photos and lines, **Then** neither the watermark nor the signature reacts to input.

---

### Edge Cases

- **Huge photos**: a 12-megapixel signature photo is reduced on the device to a size that is still sharp at the largest export (8000 px), so memory stays low on phones.
- **Uneven light**: a shadow across the paper may leave a grey patch. The Sensitivity slider is there to fix that; perfect results on bad photos aren't promised.
- **Coloured or lined paper**: the background removal targets light, plain paper. On lined or coloured paper some lines may stay, and the user can raise the sensitivity or retake the photo.
- **Tiny drawing**: a single dot or a very short stroke still counts as a signature; the user can see it and redraw.
- **Changing canvas shape or size**: the signature keeps its relative position and size, like the text watermark.
- **Dragging off the image**: the signature's center stays inside the canvas so it can always be grabbed again.
- **Rotating the phone while the pad is open**: the strokes drawn so far are kept and scaled to the new pad size.
- **Signature over a dark photo**: dark ink is hard to see. The user can pick white ink; the canvas always shows the true result.
- **Start new collage**: like the text watermark, the signature stays (it's a document-wide mark, not a photo). The user can remove it.

## Requirements *(mandatory)*

### Functional Requirements

**Where it lives**

- **FR-601**: The Watermark panel (feature 005) MUST get two tabs, **Text** (today's controls) and **Signature**. The dock is unchanged.
- **FR-602**: The tab that is selected decides what a drag on the canvas and the arrow keys move: the text watermark or the signature.

**Drawing**

- **FR-603**: **Draw signature** MUST open a pad popup that uses most of the screen on phones and desktops, with a faint signature line, and **Undo stroke**, **Clear**, **Cancel** and **Done**.
- **FR-604**: The pad MUST accept finger, mouse and pen input, follow the pointer without visible lag, and draw smoothed lines with rounded ends.
- **FR-605**: A drawn signature MUST stay sharp at any export size up to the maximum canvas (8000 px), with no visible pixel steps.
- **FR-606**: Strokes inside the pad MUST NOT enter the app's undo history. Only Done adds or replaces the signature, as one undo step.

**Uploading**

- **FR-607**: **Upload signature** MUST accept the same image types as photos, and open a popup that shows the result with the light paper background removed automatically and the ink kept, over a checkerboard.
- **FR-608**: The popup MUST have a **Sensitivity** slider that changes how much of the background is removed, with the preview updating at once (within about a tenth of a second on a mid-range phone).
- **FR-609**: The automatic first result MUST keep the ink and remove plain white or off-white paper for a typical phone photo in indoor light, without the user touching the slider.
- **FR-610**: On Done, the result MUST be cropped to the kept marks plus a small margin.
- **FR-611**: The popup MUST have a **Keep original colors** switch, off by default. When off, the ink color control recolors every kept mark; when on, the marks keep their own colors.
- **FR-612**: If nothing is kept, the popup MUST say "No signature found — try a higher sensitivity or a clearer photo" and keep Done disabled.

**Placement and look**

- **FR-613**: A new signature MUST appear near the bottom-right of the canvas (center at about 75% across and 85% down), with its width about 35% of the canvas's short side, in ink #111111 at 100% opacity, rotation 0°.
- **FR-614**: Users MUST be able to drag the signature (center kept inside the canvas), set its size (10%–80% of the short side), rotation (−90° to 90°, snapping to 0° within ±3°), opacity (10%–100%) and ink color (presets and a color picker, the same as the text watermark), and center it. Arrow keys move it by 1% (10% with Shift).
- **FR-615**: **Redraw** and **Upload** on an existing signature MUST replace its picture and keep its position, size, rotation, opacity and ink color. **Remove** MUST take it away. Each is one undo step.

- **FR-622**: With a signature placed, a **Download** button MUST save the signature alone as a transparent PNG named `signature-YYYYMMDD-HHmm.png`, upright and at full opacity, in its ink color (or original colors). Drawn signatures are saved 1600 px wide; uploaded ones at their stored resolution. The signature pad MUST offer the same **Download** for the current drawing (disabled while empty), without placing it on the image or closing the pad. *(Added 2026-11-06 at the user's request, for people who only want a digital signature.)*

**Display and export**

- **FR-616**: The signature MUST show on the editing canvas at all times, react to input only while the Signature tab is open, and appear in Preview, PNG and JPG downloads and Share in the same position, size, angle, color and opacity (within 1% of the canvas size).
- **FR-617**: The drawing order MUST be: collage, text watermark, signature, SplitFrame credit.
- **FR-618**: Every change to the signature MUST be part of undo/redo, and a drag or a slider drag MUST count as one step.

**Privacy and weight**

- **FR-619**: Drawing, background removal, placement and export MUST happen entirely on the device with no network access, keeping the existing content security policy.
- **FR-620**: The signature MUST last for the session only. It MUST NOT be saved anywhere between visits, and nothing in the app may offer to remember it.
- **FR-621**: The feature MUST NOT add any new third-party dependency, and MUST work fully on current iOS Safari and Android Chrome.

### Key Entities

- **Signature**: part of the collage document (so it's undoable), at most one. It holds the picture (either drawn strokes or a cleaned-up image), whether to keep original colors, ink color, opacity, size (width as a fraction of the short side), rotation and position (fractions of canvas width and height). No signature means none is drawn.
- **Signature pad session**: the strokes being drawn in the popup, before Done. Not part of the document or undo history.
- **Upload session**: the picked photo and the current sensitivity, before Done. Not part of the document or undo history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-601**: A first-time user on a phone can draw a signature, place it and download the image in under 45 seconds.
- **SC-602**: For 8 of 10 test photos of signatures on white paper taken with a phone indoors, the automatic result keeps the whole signature and removes the paper without moving the slider. For the other 2, the slider fixes it.
- **SC-603**: A drawn signature exported on an 8000 px canvas shows no visible pixel steps when viewed at 100%.
- **SC-604**: For the same document, the signature in Preview, Download and Share matches the canvas within 1% of the canvas size in position and size, and exactly in angle, color and opacity.
- **SC-605**: While drawing in the pad on a mid-range phone, the line keeps up with the finger with no visible gap.
- **SC-606**: The production site makes no network request carrying image or signature data (unchanged from today's zero), and after a reload no trace of the signature remains.
- **SC-607**: In a check with at least 5 people, at least 4 add a signature (drawn or uploaded) to an ID-card photo without help, and at least 4 say the uploaded signature looks like their real one.

## Assumptions

- **One signature per image**: several signatures, initials or date stamps as separate images are out of scope.
- **No Repeat for signatures**: the text watermark already covers tiling.
- **Ink is one color**: unless Keep original colors is on, the signature is drawn in one ink color. There is no pen-thickness picker in the pad: one natural-looking, pressure-free line width, scaled with the pad size.
- **Background removal is simple**: it removes light, plain backgrounds by brightness. It doesn't straighten skewed photos, fix perspective, or handle busy backgrounds; the user retakes the photo instead.
- **Kept through Start new**: the signature, like the text watermark, survives "Start a new collage", because it's a document-wide mark. It's still gone after a reload.
- **Logos come for free**: Upload with Keep original colors works for a logo on a light background. Logos on transparent PNGs work too, since transparent areas stay transparent. No separate logo feature is planned.
- **Legal meaning**: an image of a signature isn't a certified electronic signature. The app makes no such claim.
- **Depends on** feature 005 (Watermark panel, placement controls, drag and keyboard behaviour), the existing photo loading (file types, size reduction, error message) and the shared export renderer, which keeps Preview, Download and Share identical.
