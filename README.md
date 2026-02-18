# Echo Show 5 Room Card

[![HACS](https://img.shields.io/badge/HACS-Default-orange.svg)](https://github.com/hacs/default)
[![GitHub Release](https://img.shields.io/github/v/release/nfmsh/echo-show-5-room-card)](https://github.com/nfmsh/echo-show-5-room-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Activity](https://img.shields.io/github/last-commit/nfmsh/echo-show-5-room-card)](https://github.com/nfmsh/echo-show-5-room-card/commits/main)

A Home Assistant Lovelace custom card designed specifically for **Echo Show 5** style wall/tablet displays.

It renders a fixed **960×480** “stage” and scales it to **cover** the available space. The card is intended to be used as a **panel view** (single-card display), which makes sizing consistent and avoids dashboard layout quirks.

## Features

- **Echo Show 5-optimised layout** using a fixed 960×480 stage scaled to fill the screen
- **Background image** with configurable dark overlay
- **Top-left header**: title + subtitle (temp/humidity) with configurable colours and font sizes
- **Bottom-left big icon** with a halo that follows the main icon colour
- **Static badge** (fixed position)  
  - Badge **circle colour** changes based on your temperature/humidity thresholds  
  - Badge **icon changes** but stays **white**
- **Center control slot**
  - Choose a preset (thermostat/light/media/fan/entity) + entity
  - Or provide an advanced `center_card` object
  - Transparent background and optional automatic hiding of “more-info” dots
  - Per-preset scaling (light preset defaults to 1.25)
- **Buttons** (up to 8)
  - Fixed grid layout: **2 columns × 4 rows**
  - Each button supports label, icon (picker), icon colour, **label text colour**, entity, and tap action
  - Empty slots are invisible so the layout never “breaks”
  - Service picker supports autocomplete when available in your HA version

---

### Optional (Echo Show / wall display setup)

This card does not require any other integrations to function.

However, I use **Browser Mod** in my setup :
- Set kiosk mode to "TRUE"
- Set Hide header to "TRUE"

If you want the same kiosk-style presentation on an Echo Show , installing Browser Mod is recommended.
Due to the small nature of the screen on these devices i did this so there's more space for the card.

---

## Demo / Screenshots

Echo Show 5 Room Card

![Echo Show 5 Room Card](/docs/screenshots/echoshow5roomcard.png)

---

## Installation

Installation via HACS (recommended)

This card is available through HACS.

Steps:

- Open HACS in Home Assistant

- Go to Frontend

- Click Explore & Download Repositories

- Search for Echo Show 5 Room card

- Select the card and click Download

- Reload the frontend

- Add the card to your dashboard

That’s it. No manual file copying required.

After installation

HACS automatically registers the card resources.
You can now add the card from the Lovelace UI:

- Edit your dashboard

- Add Card

- Search for Echo Show 5 Room Card

- Configure using the built-in editor UI

### Manual

1. Copy the files from this repo's `dist/` folder into Home Assistant:

```
/config/www/echo-show-5-room-card/
  ├─ echo-show-5-room-card.js
  
```

2. Add both as **JavaScript Module** resources:

**Settings → Dashboards → Resources → Add Resource**

```
/local/echo-show-5-room-card/echo-show-5-room-card.js

```

3. Refresh your browser (hard refresh if needed).

---

## Recommended Setup (Panel View)

This card works best as a **panel view**:

```yaml
views:
  - title: Room
    path: room
    panel: true
    cards:
      - type: custom:echo-show-5-room-card
        title: Bedroom
        background_image: /local/images/bedroomback.jpg
        env_temp_entity: sensor.main_bedroom_temperature_temperature
        env_humidity_entity: sensor.main_bedroom_temperature_humidity

```
---

## Echo Show / Companion App Notes

Put the Companion App into fullscreen for true edge-to-edge.

---

## Configuration Options
Basic Options
| Key                   | Type   |      Default | Description                                                      |
| --------------------- | ------ | -----------: | ---------------------------------------------------------------- |
| `title`               | string |     `"Room"` | Header title text                                                |
| `background_image`    | string |         `""` | Background image URL (e.g. `/local/images/room.jpg`)             |
| `overlay_opacity`     | number |        `0.7` | Dark overlay strength (0..1)                                     |
| `env_temp_entity`     | string |         `""` | Temperature entity (also used by badge thresholds)               |
| `env_humidity_entity` | string |         `""` | Humidity entity (also used by badge thresholds)                  |
| `title_color`         | string |         `""` | CSS colour for title (blank = theme)                             |
| `title_size_px`       | number |         `26` | Title font size                                                  |
| `subtitle_color`      | string |         `""` | CSS colour for subtitle (blank = theme)                          |
| `subtitle_size_px`    | number |         `20` | Subtitle font size                                               |
| `big_icon`            | string | `"mdi:home"` | Main icon                                                        |
| `big_icon_color`      | string |     `"teal"` | Main icon colour (also drives halo + default button icon colour) |
| `big_icon_size`       | number |        `200` | Main icon size in px                                             |

---

## Badge
The badge is fixed-position (not configurable by design). It can be disabled or driven by temp/humidity thresholds.

```yaml
copy code
badge:
  mode: temp_humidity_thresholds
  humidity_high: 60
  temp_hot: 26
  temp_cold: 18
  icon_humidity: mdi:water
  color_humidity: blue
  icon_hot: mdi:fire
  color_hot: red
  icon_cold: mdi:snowflake
  color_cold: blue
```
Badge icon changes based on thresholds and stays white

Badge circle colour changes based on the matching rule

## Center Control
Option A: Preset + Entity (recommended)
```yaml
Copy code
center_preset: light         # none | thermostat | light | media | fan | entity
center_entity: light.kitchen
center_scale: 1.0
center_light_scale: 1.25
center_hide_more_info: true
Option B: Advanced center_card
If you want full control, you can pass an entire card config:
```

```yaml
Copy code
center_card:
  type: thermostat
  entity: climate.living_room
```
Note: When using center_card, the card will render as you specify.
The host card still forces transparent background and can hide more-info dots (if enabled).

---

## Buttons (Up to 8)
Buttons are arranged in a fixed grid 2 columns × 4 rows and remain stable even if you configure fewer than 8.

Example:

```yaml
Copy code
buttons:
  - label: Power
    icon: mdi:fan
    icon_color: teal
    text_color: "#ffffff"
    tap:
      action: call-service
      service: script.fan_power

  - label: Bypass
    icon: mdi:motion-sensor
    icon_color: amber
    tap:
      action: toggle
    entity: input_boolean.motion_bypass
```
## Button Fields
| Key                   | Type    | Description                                                   |
| --------------------- | ------- | ------------------------------------------------------------- |
| `label`               | string  | Button label text                                             |
| `icon`                | string  | MDI icon name (`mdi:...`)                                     |
| `icon_color`          | string  | Icon colour (blank uses `big_icon_color`)                     |
| `text_color`          | string  | Label text colour (optional)                                  |
| `disabled`            | boolean | Disable button tap (optional)                                 |
| `entity`              | string  | Optional entity for toggle / more-info                        |
| `tap.action`          | string  | `none` | `toggle` | `more-info` | `call-service` | `navigate` |
| `tap.service`         | string  | Service for `call-service` (e.g. `script.some_action`)        |
| `tap.data`            | object  | Optional service data object                                  |
| `tap.navigation_path` | string  | Path for `navigate`                                           |

---



## Support / Issues
Please include:

Your Home Assistant version

Your dashboard mode (panel vs normal)

Your card YAML config

Screenshots (Echo Show + desktop editor if relevant)

---

## Inspiration / Credit

This card was inspired by the Room Cards concept by Aguacate:
https://aguacatec.es/room-cards/

---

License
MIT

