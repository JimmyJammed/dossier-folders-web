# Accessibility

Each tab is a native button with a complete record name. Enter/Space open it.
Escape closes the record during any transition. Native dialog supplies background
inertness; keyboard wrapping keeps focus inside the modal. Close sits outside the
paper body and returns focus to the original tab. The page position is restored.

Records remain readable before enhancement, with JS disabled, or after a motion
module fails. Printing returns the scene to normal flow and exposes all records.
Media captions remain available in print; videos are not printable.

System reduced-motion and Save-Data produce immediate, usable transitions and
manual playback. Media autoplay can be disabled independently. Videos use native
controls. Galleries expose previous/next and pause/resume buttons; only manual
navigation updates live announcements. Manual pause intent survives closing and
reopening. Playback and timers stop on close, hidden tabs, offscreen media, and
teardown. A failed gallery image preserves the last visible image, reports the
error, and allows navigation to another image.

Provide meaningful alternative text and captions. Silent demo videos have
descriptive labels/captions; if using spoken audio, provide appropriate captions
or a transcript in adjacent text. The component does not author captions for you.
Choose colors with adequate contrast; the editor reports text contrast and offers
auto ink. Arbitrary consumer colors are not automatically overridden.

Automated browser coverage is listed in VALIDATION.md. Mobile emulation is not
physical-device testing, and keyboard checks are not a full assistive-technology
certification.
