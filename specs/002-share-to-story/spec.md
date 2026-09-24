# Feature Specification: Share to Story

**Feature Branch**: `002-share-to-story`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "as you know we can download the images, but i want this to be share as a story at instagram or whatsapp, do you got the idea? so once the user are done with the drawing and annotate, they can immediately share this final pics to instagram or whatsapp story without saving it. What do you think?"

## Overview

Today a finished collage can only be downloaded. To post it as an Instagram Story or WhatsApp Status, the user has to download the file, leave SplitFrame, open the other app, and find the file in their gallery. This feature adds a **Share** action that hands the finished image straight to the device's share options, so the user can pick Instagram or WhatsApp and post it as a Story in a few taps, without first saving it to their photos.

SplitFrame runs in the browser, so it cannot post to Instagram or WhatsApp by itself. It hands the image to the device's own share menu, and the user picks the target app there. Instagram and WhatsApp then show their own screen to choose "Story" / "Status" and post. This keeps SplitFrame fully on-device (FR-001 of the base spec): the image only leaves the device when the user posts it from the other app.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share a finished collage to a Story from the phone (Priority: P1)

A user finishes a collage on their phone (layout, drawn lines, photos, style). They tap **Share**. The phone's share menu opens with the collage attached. They pick Instagram (or WhatsApp), choose Story (or Status) there, and post it. They never had to download the file or go looking for it in their gallery.

**Why this priority**: This is the whole point of the feature. Most collages made in a 9:16 Story shape are meant to be posted as Stories, and this removes the download-then-find step.

**Independent Test**: On a phone with Instagram and WhatsApp installed, build a 9:16 collage with 3 photos, tap Share, pick Instagram, and confirm the Story editor opens with the collage filling the Story frame. Repeat with WhatsApp and confirm the Status editor opens with the collage. Confirm no new file appeared in the phone's photo gallery or downloads.

**Acceptance Scenarios**:

1. **Given** a collage with at least one photo on a phone that supports sharing files, **When** the user taps Share, **Then** the device's share menu opens with one image attached that looks exactly like the export would (same size, crops, gap, padding, radius and colors).
2. **Given** the share menu is open, **When** the user picks Instagram, **Then** Instagram opens with the image ready to post, where the user can choose to post it as a Story.
3. **Given** the share menu is open, **When** the user picks WhatsApp, **Then** WhatsApp opens with the image ready to send, where the user can choose to post it to their Status.
4. **Given** the user shares a collage, **When** the share finishes or is cancelled, **Then** no copy of the image has been saved to the device's gallery or downloads by SplitFrame.
5. **Given** the share menu is open, **When** the user dismisses it without choosing an app, **Then** they return to the editor with the collage unchanged and no error message is shown.
6. **Given** the user returns to SplitFrame after posting, **When** the page is shown again, **Then** the collage is still there exactly as before, so they can tweak it and share again.

---

### User Story 2 - Share is easy to find at the moment the collage is done (Priority: P2)

When the user feels "done" they are usually looking at the Preview or opening Export. The Share action sits in both places, next to Download, so the user does not have to hunt for it.

**Why this priority**: Share only helps if people see it at the right moment. It builds on Story 1 but is not needed to prove sharing works.

**Independent Test**: Fill all cells, open Preview, and confirm Share is offered there. Close Preview, open the Export panel, and confirm Share is offered next to Download. Both lead to the same share menu.

**Acceptance Scenarios**:

1. **Given** Preview is open, **When** the user looks at its actions, **Then** Share is offered alongside Export.
2. **Given** the Export panel is open, **When** the user looks at its actions, **Then** Share is offered next to Download, and both use the same format and quality settings.
3. **Given** the device supports sharing images, **When** the Export panel opens, **Then** Share is the more prominent action on phones and Download stays available.

---

### User Story 3 - Sensible fallback where sharing is not possible (Priority: P3)

On a device or browser that cannot share files (for example most desktop browsers), the user is not left with a broken button. The Share action is hidden, and Download works as before.

**Why this priority**: Protects the existing experience on desktop and older browsers. Needed for quality, but it adds no new value on its own.

**Independent Test**: Open SplitFrame in a desktop browser that cannot share files. Confirm no Share action is shown and Download works exactly as before.

**Acceptance Scenarios**:

1. **Given** a browser that cannot share image files, **When** the user opens Preview or the Export panel, **Then** no Share action is shown and Download is shown as today.
2. **Given** a browser that reports it can share, **When** sharing fails for a reason other than the user cancelling, **Then** the user sees a short message offering Download instead, and nothing is downloaded without them choosing it.

---

### Edge Cases

- **Collage shape is not 9:16**: the image is shared at its real shape (for example 1:1). Instagram and WhatsApp place it inside the Story frame with their own background. When the canvas is not 9:16, the Share area shows a short hint that 9:16 fills a Story best, but it does not block sharing.
- **Empty cells**: shared like the export: empty cells show the background color. Like Download, Share stays available even when no cell has a photo.
- **Very large custom sizes**: if the device cannot make the image (same limit as export), the user sees the same "try a smaller size" error, and the share menu does not open.
- **Instagram / WhatsApp not installed**: they simply do not appear in the share menu; the user can still pick other apps. SplitFrame does not need to detect this.
- **User taps Share twice quickly**: only one share menu opens; the Share action shows a busy state while the image is being prepared.
- **Preparing takes a moment**: the image is prepared at full size, which can take a few seconds on phones. The Share action shows it is working, and the share menu opens as soon as the image is ready.
- **Browser needs the share to start straight from the tap**: if preparing the image takes too long for the browser to allow the share menu, the user is asked to tap once more to open it ("Your image is ready — tap to share"), instead of seeing a silent failure.
- **PNG vs JPG**: the shared image uses the format and quality chosen in export settings (PNG by default), so Share and Download always give the same file.

## Requirements *(mandatory)*

### Functional Requirements

**Sharing**

- **FR-101**: Users MUST be able to share the finished collage as a single image file to the device's share menu, from which they can pick Instagram, WhatsApp or any other app that accepts images.
- **FR-102**: The shared image MUST be identical to what Download would produce with the current settings: same pixel size, cell positions, crops, gap, padding, radius, colors, format and quality.
- **FR-103**: Sharing MUST NOT save a copy of the image to the device's gallery, downloads folder or any other storage visible to the user.
- **FR-104**: The shared file MUST carry the same name pattern as downloads (`splitframe-YYYYMMDD-HHmm.png` / `.jpg`), so apps that show a file name show a meaningful one.
- **FR-105**: Sharing MUST keep the privacy rule of the base spec (FR-001): SplitFrame itself sends nothing over the network. The image leaves the device only through the app the user picks and only when the user posts it there.
- **FR-106**: Cancelling the share menu MUST return the user to where they were, with the collage unchanged and no error message.
- **FR-107**: The collage MUST remain in the editor after sharing, so the user can change it and share again.

**Where Share appears**

- **FR-108**: Share MUST be offered in Preview (next to Export) and in the Export panel (next to Download).
- **FR-109**: On devices that can share images, Share MUST be the most prominent action in the Export panel on phone-sized screens; Download MUST stay available.
- **FR-110**: Share MUST be available whenever Download is. Download is never disabled for an empty collage (empty cells export in the background color), so Share is not either; both are disabled only while an image is being prepared.
- **FR-111**: When the canvas is not 9:16, the Share area MUST show a short, non-blocking hint that 9:16 fills a Story best.

**Availability and errors**

- **FR-112**: On browsers that cannot share image files, Share MUST NOT be shown; Download MUST behave exactly as before.
- **FR-113**: While the image is being prepared, Share MUST show a busy state and ignore further taps.
- **FR-114**: If the image cannot be made (for example the size is too large for the device), the user MUST see the same clear error as for Download and the share menu MUST NOT open.
- **FR-115**: If sharing fails for any reason other than the user cancelling, the user MUST see a short message offering Download instead. Nothing MUST be downloaded unless the user chooses it.
- **FR-116**: If the browser refuses to open the share menu because preparing the image took too long after the tap, the app MUST keep the prepared image and ask the user to tap once more to share it.

**Accessibility**

- **FR-117**: Share MUST be reachable and usable with touch, with a keyboard, and with a screen reader, with a clear label (for example "Share to Story or other apps").

### Key Entities

- **Shared image**: The finished collage as one image file, made from the same layout, photos and style as the export, in the chosen format and quality, with the export file name. Exists only while being handed to the share menu; never stored by SplitFrame.
- **Share target**: An app the user picks from the device's share menu (for example Instagram or WhatsApp). Chosen and controlled by the device and the other app, not by SplitFrame.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101**: On a supported phone, a user can go from a finished collage to the Instagram Story or WhatsApp Status editor in 3 taps or fewer inside SplitFrame (Share, then pick the app), without visiting their gallery.
- **SC-102**: The share menu opens within 3 seconds of tapping Share for a 1080×1920 collage with 6 phone-camera photos on a typical mid-range phone.
- **SC-103**: In 100% of shares, the shared image has the same pixel size and appearance as a download made with the same settings.
- **SC-104**: In 100% of shares (completed or cancelled), no new file appears in the device's gallery or downloads.
- **SC-105**: On browsers without file sharing, 0 users see a Share action that does nothing; Download works as before.
- **SC-106**: In testing with at least 5 people, at least 4 find and use Share to post a Story on their first try without help.

## Assumptions

- **Share menu, not direct posting**: SplitFrame is a browser app, so it cannot post directly into Instagram or WhatsApp or pick "Story" for the user. It hands the image to the device's share menu; the user picks the app and chooses Story/Status there. Direct "post to Story" buttons are out of scope.
- **Supported devices**: Sharing files is expected to work on current iOS Safari and Android Chrome, which is where Stories are posted. Desktop browsers mostly fall back to Download only.
- **"Drawing and annotate"** refers to the existing editing flow (drawing layout lines, adding photos, adjusting style). Adding text, stickers or free drawing on top of the collage is not part of this feature.
- **Format**: Sharing uses the existing export settings (PNG by default, or JPG at the chosen quality). No separate share format setting is added; Instagram and WhatsApp accept both.
- **Story shape**: The 9:16 preset (1080×1920) already matches the Story frame; no new canvas size is needed.
- **Instagram/WhatsApp behavior**: How those apps show the incoming image (Story vs. feed vs. chat choice, cropping, background) is controlled by them and may change; SplitFrame's job ends when the share menu has the image.
- **Depends on** the existing export rendering (base spec FR-031 to FR-035) and Preview (FR-042 to FR-044).
