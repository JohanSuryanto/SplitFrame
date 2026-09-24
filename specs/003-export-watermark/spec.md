# Feature Specification: Export Watermark

**Feature Branch**: `003-export-watermark`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "watermark with website, on by default, toggle in export"

Earlier discussion (same session): watermark on shared and downloaded images, can be switched on or off before sharing or downloading, and includes the website address.

## Overview

Collages made in SplitFrame are mostly posted as Instagram Stories and WhatsApp Statuses (feature 002). A small, tasteful credit such as "SplitFrame · splitframe.johansuryanto.dev" on those images tells viewers where the collage was made, so each shared Story can bring in new users. The watermark is **on by default**, and a single switch in the Export panel turns it off for anyone who wants a clean image. The same setting applies to Download, Share and Preview, so all three always show the same image.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exported and shared images carry a small website credit (Priority: P1)

A user finishes a collage and downloads or shares it without changing anything. The resulting image has a small, readable credit with the SplitFrame name and website address near the bottom. It is clearly visible when someone looks for it, but it does not compete with the photos.

**Why this priority**: This is the reason for the feature. Every shared collage points back to the website.

**Independent Test**: Make a 9:16 collage with 3 photos, download it, and open the file. A small "SplitFrame · splitframe.johansuryanto.dev" credit sits at the bottom center, readable on both a bright and a dark photo. Share the same collage to an Instagram Story. The credit is visible and not hidden behind Instagram's reply bar or profile header.

**Acceptance Scenarios**:

1. **Given** a new session where the user has not touched the watermark setting, **When** they download or share a collage, **Then** the image includes the credit "SplitFrame · splitframe.johansuryanto.dev".
2. **Given** the watermark is on, **When** the user opens Preview, **Then** Preview shows the credit exactly where and how it will appear in the file.
3. **Given** the watermark is on and the bottom of the collage is a very bright or very dark photo, **When** the image is exported, **Then** the credit is still readable.
4. **Given** a 9:16 collage with the watermark on, **When** it is posted as an Instagram Story or WhatsApp Status, **Then** the credit is not covered by those apps' own controls at the top and bottom of the screen.
5. **Given** collages at different sizes (for example 1080×1920 and 2160×3840), **When** they are exported, **Then** the credit takes up the same share of the image in each.

---

### User Story 2 - Turn the watermark off for a clean image (Priority: P1)

A user wants an image without any credit, for example for a personal album or a client. In the Export panel they switch **Watermark** off. Download, Share and Preview all give a clean image straight away.

**Why this priority**: The user explicitly asked for the watermark to be optional. Without an easy off switch, an on-by-default watermark would push people away. It ships together with Story 1.

**Independent Test**: Open Export, switch Watermark off, and download. The file has no credit. Open Preview: no credit. Share: no credit. Switch it back on: the credit returns in all three.

**Acceptance Scenarios**:

1. **Given** the Export panel is open, **When** the user looks at it, **Then** a clearly labelled Watermark switch is shown, set to on, with a short description of what it adds.
2. **Given** the user switches Watermark off, **When** they download, share or open Preview, **Then** none of them shows the credit.
3. **Given** the user switched Watermark off, **When** they keep editing the collage in the same session, **Then** the setting stays off until they change it.
4. **Given** the user reloads the page or comes back later, **When** they open Export, **Then** Watermark is on again (nothing is remembered between sessions).
5. **Given** the user changes the Watermark switch, **When** they press Undo, **Then** the switch is not undone; like format and quality, it is an export setting and not part of the collage's edit history.

---

### Edge Cases

- **Non-Story shapes** (1:1, 4:5, 16:9, custom): the credit stays at the bottom center, inside the image, with the same relative size and margin. The Story safe-area rule applies only to 9:16.
- **Very small custom canvases** (for example 100×100): the credit is never drawn so small that it becomes an unreadable smudge. If it can't fit at a readable size, it is left out, and the Export panel says so ("Too small for a watermark").
- **Very wide or very tall custom canvases**: the credit is sized from the canvas's short side and never runs wider than the image; if needed it is scaled down to fit.
- **Padding and background color**: the credit is placed over whatever is at the bottom center (a photo, a gap or padding) and keeps its readable treatment on any of them.
- **Empty collage**: the credit still appears on the background color if Watermark is on, matching what Download produces today.
- **Sharing from Preview**: switching Watermark in the Export panel while Preview's pre-rendered image exists must not share a stale image. The shared image always matches the current setting.
- **Share and Download stay identical**: with the same settings, the shared and downloaded images match, watermark included (feature 002, FR-102).

## Requirements *(mandatory)*

### Functional Requirements

**Watermark content and look**

- **FR-201**: When Watermark is on, exported and shared images MUST include the credit text "SplitFrame · splitframe.johansuryanto.dev".
- **FR-202**: The credit MUST be placed at the bottom center of the image, inside the image bounds.
- **FR-203**: On 9:16 canvases, the credit MUST sit above the area that Instagram and WhatsApp cover with their reply/send controls, so it remains visible in a posted Story or Status. For this spec, that means the credit's bottom edge is 5% of the canvas height above the bottom edge (about 96 px on 1920), so it reads as "at the bottom" while leaving a little room. *(Changed 2026-09-24 from 12% at the user's request: 12% looked like it was floating. On tall phones Instagram shows its reply bar below the Story, so the bottom isn't covered; WhatsApp's Reply button may touch the credit on some phones.)*
- **FR-204**: On other shapes, the credit's bottom edge MUST sit a small, fixed fraction of the canvas's short side above the bottom edge (about 3%).
- **FR-205**: The credit MUST be readable on any background (bright, dark or busy photos, and any background color), for example by using light text with a soft shadow or a subtle translucent backing.
- **FR-206**: The credit size MUST scale with the canvas's short side, so it covers the same proportion of the image at any resolution. Its text height MUST be about 2.5% of the short side (about 27 px on a 1080-wide Story, roughly 10 pt when the Story fills a phone screen, the smallest comfortably readable size).
- **FR-207**: The credit MUST never be wider than 90% of the canvas width; if it would be, it MUST be scaled down to fit.
- **FR-208**: If the credit would be smaller than a readable minimum (text height under 10 px in the exported image), it MUST be left out, and the Export panel MUST say "Too small for a watermark" next to the switch.

**Setting**

- **FR-209**: The Export panel MUST contain a Watermark on/off switch with a visible label and a short description (for example "Adds 'SplitFrame · splitframe.johansuryanto.dev' at the bottom").
- **FR-209a**: Preview MUST also show a Watermark on/off switch next to its Share and Export actions, bound to the same setting as the Export panel. Changing it MUST redraw Preview at once, so users can compare with and without the credit before sharing. *(Added 2026-09-24 at the user's request.)*
- **FR-210**: Watermark MUST be on at the start of every session and MUST NOT be remembered between sessions, in line with the base rule that nothing is saved between sessions.
- **FR-211**: The Watermark setting MUST apply equally to Download, Share and Preview. For the same collage and settings, all three MUST show the same image.
- **FR-212**: Changing the Watermark setting MUST NOT be recorded in undo/redo history, the same as format and quality.
- **FR-213**: The switch MUST be usable with touch, mouse and keyboard, and MUST announce its on/off state to screen readers.

**Privacy and consistency**

- **FR-214**: The watermark MUST be drawn on the device as part of the image, with no network access, keeping the base privacy rule (FR-001).
- **FR-215**: While the user is editing, the watermark MUST NOT be shown on the canvas, so it never gets in the way while arranging photos or drawing lines. While the **Export panel is open**, the canvas MUST show the credit exactly as it will appear in the file, and it MUST appear and disappear as the Watermark switch is flipped. That overlay MUST NOT react to taps, clicks or drags, and it MUST be hidden from screen readers (the switch is the accessible control). Preview and exported and shared images show it whenever Watermark is on. *(Revised on 2026-09-24 at the user's request: a faint always-on editor copy was tried and removed. Flipping the switch in Export then had no visible effect, so the credit now shows only while Export is open.)*

### Key Entities

- **Watermark setting**: an on/off value that sits next to format and quality in the export settings. It defaults to on, lasts for the session only, and is not part of the collage or its undo history.
- **Credit**: the fixed text "SplitFrame · splitframe.johansuryanto.dev", with its placement (bottom center, safe area on 9:16), size (relative to the short side) and readability treatment.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-201**: 100% of downloads and shares made with the default settings include the credit, and 100% made with Watermark off contain none.
- **SC-202**: For the same collage and settings, Preview, Download and Share show the credit in the same place and size, within 1% of the canvas size.
- **SC-203**: On a 9:16 collage posted as an Instagram Story and as a WhatsApp Status, the credit is fully visible and not covered by the apps' controls, on both iPhone and Android.
- **SC-204**: The credit takes up the same proportion of the image (within 5%) at 1080×1920 and at 2160×3840.
- **SC-205**: In a check with at least 5 people, at least 4 can read the website address on a phone screen from a posted Story, and at least 4 describe the credit as "not distracting".
- **SC-206**: A user can find and switch off the watermark in under 10 seconds from opening the Export panel, without help.

## Assumptions

- **Text, not a logo**: the credit is text only (name and address). A logo mark can be added later, but it is not part of this feature.
- **Fixed text**: users can't edit the credit text or position. They can only switch it on or off.
- **Not remembered**: the watermark resets to on at the start of every visit, because SplitFrame saves nothing between sessions. Remembering the choice would need the privacy note in the README to change, so it is out of scope.
- **Safe-area numbers**: Instagram and WhatsApp don't publish exact overlay sizes and change them over time. The 5% bottom margin in FR-203 was the user's choice over a cautious 12%. Check it during testing (SC-203).
- **Address**: the credit uses the production address `splitframe.johansuryanto.dev`. If the domain changes, the text changes with it.
- **Depends on** the shared export renderer (base spec FR-032, FR-042) and the Share to Story feature (002, FR-102), which require Preview, Download and Share to produce the same image.
