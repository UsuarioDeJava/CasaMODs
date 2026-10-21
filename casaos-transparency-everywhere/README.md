# Transparency Everywhere for CasaOS

A [CasaMOD](https://github.com/Cp0204/CasaMOD) mod, CSS plus a small script for its settings. Gives the rest of CasaOS the frosted glass of the dashboard widgets: the top bar, its Account and Settings menus and the dialogs (App Store, Terminal, Logs, app settings…) become translucent and blurred, with light text. Goes well with an animated wallpaper.

## How it works

- **Top bar** (`.navbar.top-bar`): transparent, with the glass on a `::before` so its blur doesn't cut the blur of the menus that open from it.
- **Menus and dialogs** (`.top-bar .dropdown-menu .dropdown-content`, `.modal .modal-card`): translucent dark background with `backdrop-filter: blur(20px) saturate(1.8)`, transparent headers and footers, light text, darker fields (password ones too, as in Account > Change password) and inner cards. Buttons, colored texts (`has-text-danger` and the like), colored icons (`casa-color-*`, like the folder icons), error messages and links keep their color; gray and black texts (`has-text-gray*`, `has-text-grey*`, `has-text-black`) become a dimmer light; the terminal is untouched.
- **Boxes CasaOS draws light:** the folder list of "Select Shared Folder" (Files > Shared, `.folder-list`), the notes of an update or a share (`.update-info-container`) plain notes (`.notification`, as in New folder), the Storage Manager's storage cards (`.background-item`) and merge box (`.combination-box`), and white boxes (`.has-background-white`) get the darker inner-card look; usage bars (`progress`) a light glass track; tag fields (`.taginput`, as Container Capabilities in a custom app) the darker field look; tags (`.tag`) a light glass; the storage manager's red notes (`.message.is-danger`) and warning notes (`.message-alert`, `.pri-message-alert`, the merge-storage notes) become tinted glass.
- **App Store:** neutral buttons, the "Install"/"Start and open" buttons, card hover, the app description (no white box), a dark loading veil.
- A dialog **inside** a dialog (an app's details in the store) gets a solid background, because glass over glass doesn't blur and what's behind shows through. Dropdowns inside dialogs are solid too, for readability.
- The **file manager** (`.file-panel`) is left as CasaOS draws it.

CasaOS updates that rename these classes may need the selectors adjusted.

## Settings: `config.json`

The mod's folder has a `config.json` with its settings, in the format every mod of this repository uses ([CONFIG.md](../CONFIG.md)): each setting describes itself (type, choices or limits, default, name in all 31 CasaOS languages), so the CasaMOD Store shows and changes them. By hand, change only a setting's `"value"`. A value outside its rules counts as the default.

| Setting (`key`) | Type | Values | Default | What it does |
| --- | --- | --- | --- | --- |
| `blur` | `number` | `0` to `40`, step `1` (px) | `20` | How much the menus and dialogs blur what's behind them. |
| `tint` | `number` | `0` to `90`, step `5` (%) | `40` | How dark the glass is (the top bar's too). |
| `topBar` | `boolean` | `true` or `false` | `true` | The top bar in glass. `false`: CasaOS's own top bar (its menus stay in glass). |

They apply when the CasaOS tab comes back in sight (`"applies": "visible"`: switch to another tab and back), without reloading.

Copying a newer folder over the old one brings the new `config.json` with the default values: the CasaMOD Store keeps your values (CONFIG.md says how); by hand, note yours and set them again.

A small script (`mod.js`) hands the settings to the CSS as variables (`--te-blur`, `--te-tint`, `html.te-no-bar`); without it, the CSS keeps these defaults.
## Install

1. Install **CasaMOD** from the CasaOS app store (or from its repository).
2. Copy the `transparency-everywhere` folder into `/DATA/AppData/casamod/mod/` on the CasaOS machine.
3. Restart CasaMOD and reload the CasaOS page (Ctrl+F5).

It was called **Transparence Everywhere** (folder `transparence-everywhere`) until 1.1.0: if that folder is on the server, remove it when you copy this one.

To remove it, move `transparency-everywhere` out of `/DATA/AppData/casamod/mod/` and restart CasaMOD.
