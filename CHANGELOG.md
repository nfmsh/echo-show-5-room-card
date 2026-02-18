# Changelog

All notable changes to **Echo Show 5 Room Card** will be documented in this file.

The format is based on *Keep a Changelog*, and this project aims to follow Semantic Versioning.

---

## [0.1.0] - 2026-02-18

### Added
- Initial public release of `custom:echo-show-5-room-card`
- Echo Show 5 focused rendering using a fixed **960×480 stage** scaled to **cover** the container
- Editor-safe behaviour:
  - Fullscreen/panel behaviour disabled inside the Lovelace editor/preview
- Room header:
  - Room title + subtitle (temp/humidity)
  - Configurable title/subtitle text colour and font sizes
- Background:
  - Optional background image
  - Configurable dark overlay opacity
- Main icon (bottom-left):
  - Large icon with halo
  - Halo colour follows main icon colour
- Static badge:
  - Fixed-position badge (not user-movable)
  - Badge circle colour changes based on temp/humidity thresholds
  - Badge icon changes but remains white
- Center control:
  - Presets: thermostat, light, media-control, fan, generic entity
  - Advanced `center_card` object support
  - Transparent background enforcement for embedded center card
  - Optional automatic hiding of center-card “more info” dots
  - Center scaling controls (including a dedicated light scale)
- Buttons (up to 8):
  - Fixed grid: **2 columns × 4 rows**
  - Stable layout even when fewer than 8 buttons are configured
  - Per-button label, icon (picker), icon colour, and label text colour
  - Actions: none, toggle, more-info, call-service, navigate
  - Service autocomplete via `ha-service-picker` when available
  - “Add button” disabled when maximum reached

### Changed
- Removed `center_show_name` option (names are always hidden for generated center presets)

### Fixed
- Empty button slots no longer show a dotted outline (slots are hidden but preserve layout)
- Improved center control rendering consistency (transparent background and optional more-info suppression)

---

## [Unreleased]
### Added
### Changed
### Fixed
