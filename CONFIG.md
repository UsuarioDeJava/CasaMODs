# Mod settings: `config.json`

A mod with settings ships a `config.json` next to its `mod.js`. Its structure is fixed and describes itself, so one interface (the CasaMOD Store) can show and change the settings of any mod without knowing that mod: each setting says its type, its current and default value, its name and description in every CasaOS language, its choices or its limits, and when a change takes effect.

This is **format 1**. Fields may be added to it later, and readers ignore the fields they don't know. A change that would break a reader of format 1 gets a new format number.

[`casaos-app-usage/app-usage/config.json`](casaos-app-usage/app-usage/config.json) is an example, with a `select` and a `number`.

## The file

```json
{
  "format": 1,
  "settings": [
    { "key": "show", "type": "select", "value": "hover", "default": "hover", "applies": "visible",
      "label": { "en": "Show the gauges", "pt": "Mostrar os medidores" },
      "description": { "en": "When the CPU and RAM gauges appear on the app cards." },
      "options": [
        { "value": "hover", "label": { "en": "On hover", "pt": "Ao passar o mouse" } },
        { "value": "always", "label": { "en": "Always", "pt": "Sempre" } }
      ] },
    { "key": "interval", "type": "number", "value": 3, "default": 3, "min": 1, "max": 60, "step": 1,
      "unit": { "en": "s" }, "applies": "visible",
      "label": { "en": "Update every", "pt": "Atualizar a cada" } }
  ]
}
```

(Shortened: the mods of this repository give every text all 31 languages.)

| Field | Value |
| --- | --- |
| `format` | `1` |
| `settings` | The settings, in the order an interface shows them. |

## A setting

Every setting has these fields:

| Field | Type | Required | What it is |
| --- | --- | --- | --- |
| `key` | string | yes | The setting's id: unique in the file, never renamed. Letters and digits, starting with a lowercase letter (`show`, `interval`, `maxItems`). |
| `type` | `"select"`, `"number"`, `"boolean"` or `"text"` | yes | The kind of value, and which of the fields below come with it. |
| `value` | depends on `type` | yes | The current value. **The only field an interface changes.** |
| `default` | depends on `type` | yes | The value the mod uses when `value` is missing or not valid. An interface can offer "reset" with it. |
| `label` | text map | yes | The setting's name. |
| `description` | text map | no | A sentence or two on what it does. |
| `applies` | `"visible"` or `"reload"` | yes | When a change takes effect: `"visible"`, when the CasaOS tab comes back in sight (switching to another tab and back is enough); `"reload"`, after CasaOS is reloaded (Ctrl+F5). |

And, by type:

### `select`: one choice from a list

| Field | Type | Required | What it is |
| --- | --- | --- | --- |
| `options` | array of `{ "value": string, "label": text map }` | yes | The choices, at least two, in the order to show them. Their `value`s are unique. |

`value` and `default` are one of the options' `value`s. An interface shows a list, or buttons, with the options' labels.

### `number`: a number within limits

| Field | Type | Required | What it is |
| --- | --- | --- | --- |
| `min` | number | yes | The smallest value allowed. |
| `max` | number | yes | The largest value allowed (greater than `min`). |
| `step` | number | yes | The step between allowed values (greater than 0): a value is `min` plus a whole number of steps (with `min: 1, step: 1`: 1, 2, 3…). |
| `unit` | text map | no | Shown after the number (`s`, `px`, `%`). |

`value` and `default` are numbers between `min` and `max` (both included), on a step. An interface shows a number field or a slider with these limits.

### `boolean`: on or off

No more fields. `value` and `default` are `true` or `false`. An interface shows a switch.

### `text`: a short text

| Field | Type | Required | What it is |
| --- | --- | --- | --- |
| `maxLength` | whole number | yes | The most characters allowed (1 or more). |
| `pattern` | string | no | A JavaScript regular expression, without the slashes, that the whole value must match (`^[a-z0-9-]*$`). |

`value` and `default` are strings within them. An interface shows a text field.

## Text maps

A text map is an object from CasaOS language codes to strings: `{ "en": "Always", "pt": "Sempre" }`.

- `en` is required. The other codes are CasaOS's languages: `ar`, `be`, `bg`, `ca`, `cs`, `de`, `el`, `es`, `fr`, `hr`, `hu`, `id`, `it`, `ja`, `ko`, `nl`, `no`, `pl`, `pt`, `pt-pt`, `ro`, `ru`, `sk`, `sl`, `sv`, `tr`, `uk`, `vi`, `zh-cn`, `zh-tw`.
- `pt-pt` holds only what differs from `pt` (Portuguese from Portugal falls back to Brazilian Portuguese).
- The mods of this repository fill all of them; their tests check it.

Which text to show, for CasaOS's language (`localStorage.lang`, as `pt_br`, made lowercase with `_` turned into `-`, as `pt-br`), the first one present of:

1. that code (`pt-br` isn't one; `zh-cn` is);
2. for `zh-…`: `zh-tw` when it ends in `-tw`, `-hk`, `-mo` or `-hant`, else `zh-cn`;
3. for `pt-…`: `pt-pt` when it is `pt-pt`, then `pt`;
4. for `nb` or `nn`: `no`;
5. the code before the `-` (`pt` for `pt-br`, `de` for `de-at`);
6. `en`.

## For an interface (the CasaMOD Store)

1. **Show:** read the mod's `config.json` (in the mod's folder, `/DATA/AppData/casamod/mod/<folder>/config.json`); show each setting by its `type`, in the file's order, with its label and description in CasaOS's language, and for a number its limits and unit.
2. **Save:** change only the `value` fields, keep every other field as it is, and write the file back as JSON in UTF-8. Check a value against its setting's rules before writing it: one outside them isn't saved.
3. **Say when it applies:** `applies` (`"visible"`: switch to another tab and back; `"reload"`: reload CasaOS).
4. **Keep the user's choices when a mod is updated** (its folder replaced by a newer one, with a new `config.json`): read the old file's values before replacing the folder. Then, in the new file, each setting with the same `key` and the same `type` whose old value is still valid by the new file's rules gets the old value; the others keep the new file's. Settings the new file no longer has are dropped.
5. Don't put anything secret in it: CasaMOD serves the mod folders to anyone who can open CasaOS (`/mod/<folder>/…`).

## For a mod

- Ship `config.json` with each `value` equal to its `default`.
- Keep the defaults and limits in the mod's code too, and never trust the file: read each `value` by its `key`; a missing, unknown or invalid value falls back to the default.
- Read it from the mod's own folder: `new URL('config.json', document.currentScript.src)` (CasaMOD loads each mod as `<script src="mod/<folder>/mod.js">`), with `cache: 'no-store'`, at load, and again when the tab comes back in sight if a setting has `"applies": "visible"`.
- Have a test check the file against this format, every text in all 31 languages, and the defaults equal to the code's (as [`casaos-app-usage/tests/config-check.js`](casaos-app-usage/tests/config-check.js)).
- Document the settings in the mod's README.
