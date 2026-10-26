# World Clock

A world clock you install on Windows from your browser. Click any city's time, type a new one, and every other city converts instantly.

## Put it online (one-off, ~5 minutes)

1. Sign in to GitHub → **+** (top right) → **New repository**.
   Name it `world-clock`, leave it **Public**, tick **Add a README file**, click **Create repository**.
2. In the new repo: **Add file → Upload files**. Drag in *everything* from this folder, including the `icons` folder. Click **Commit changes**.
3. **Settings → Pages**. Under *Branch*, choose `main` and `/ (root)`, click **Save**.
4. Wait a minute, refresh that page. It shows your link:
   `https://YOUR-USERNAME.github.io/world-clock/`

## Install it on your laptop

1. Open your link in **Edge**.
2. Click the **App available** icon in the address bar. If you don't see it: **⋯ menu → Apps → Install World Clock**.
3. It opens in its own window and appears in the Start menu.
4. Right-click its taskbar icon → **Pin to taskbar**.
5. Optional: open `edge://apps`, find World Clock, and turn on **Start app when you sign in**.

Chrome works the same way: **⋮ menu → Cast, save and share → Install page as app**.

## Using it

| Do this | To |
|---|---|
| Click a time and type | Convert. It understands `9am`, `9.30pm`, `14:30`, `1430`, `noon`, `3pm tomorrow`, `fri 10am`, `10am +1` |
| **Enter** / **Esc** | Keep the converted time / cancel |
| **±1 day** in the Converting bar | Shift the converted time a day |
| **Back to now** | Return to the live clock |
| Tick rows → **Copy N times** | Copies just those times, e.g. `NZDT Tue 27th 11am / MDT Mon 26th 4pm`. Ticks are remembered. **Select all** in the footer |
| ⚙ → **Copy format** | Change the wording with tokens, add your meeting link, see a live preview |
| Drag ⋮⋮, or focus it and press ↑/↓ | Reorder |
| Hover a row → house / × | Make it home / remove it |
| Hover a row → ✎ (or double-click the name) | Set your own label and notes |
| Hover or click ⓘ | See that row's notes (only shown once a row has notes) |
| ⚙ → **Appearance** | Pick one of 7 themes, fine-tune with 4 colour pickers, change the header subtitle |
| ⚙ | Working hours, export/import backup, reset |

Reading a row: a **−1 day / +1 day** tag means a different day from home. The **orange note** (e.g. `19h from 1 Nov`) means daylight saving is about to change the gap. The **bar** shows the day, with working hours shaded. The marker turns orange outside working hours.

## Copy format tokens

Set in ⚙ → **Copy format**. Click a token chip to insert it.

| Token | Example | Use in |
|---|---|---|
| `{abbr}` | NZDT | Each time |
| `{city}` | Denver | Each time |
| `{weekday}` | Mon | Each time |
| `{day}` / `{dayth}` | 26 / 26th | Each time |
| `{month}` | Oct | Each time |
| `{time}` | 4pm, 4:30pm (16:00 in 24h mode) | Each time |
| `{time24}` | 16:00 | Each time |
| `{times}` | All ticked times, joined | Message |
| `{meetingLink}` | Your link from ⚙ | Message |

Example message: `{times}` on one line, then `Join here: {meetingLink}` on the next.
Your meeting link is saved in this browser only. It's never in the code on GitHub, but it **is** included in Export backups.

## Where your data lives

Your cities and settings are saved **in your browser on this computer only**. Nothing is sent anywhere. Use ⚙ → **Export** to back up, or to move your setup to another computer.

## Sharing with the team

Send them your link and they install it the same way. Each person gets their own list.
To change what **new** users start with, edit `team-defaults.json` in GitHub (click the file → pencil icon).

## Making changes

1. Edit a file on GitHub (pencil icon) or upload a replacement.
2. In `sw.js`, bump `CACHE_VERSION` (e.g. `'wc-v1'` → `'wc-v2'`) so installed copies pick up the change.
3. Close and reopen the app. Sometimes it takes two opens: the first downloads the update, the second shows it.

## What each file does

| File | Job |
|---|---|
| `index.html` | The page layout: banner, list, buttons, dialogs |
| `styles.css` | The look, including dark mode |
| `tz.js` | All the time-zone maths and parsing what you type. No screen code |
| `app.js` | Draws the rows, handles clicks, typing, drag, saving |
| `cities.js` | City → time-zone list for search. Add your own lines |
| `team-defaults.json` | The starting list for new users |
| `manifest.webmanifest` | Tells Windows the app's name and icon. Makes it installable |
| `sw.js` | Keeps an offline copy so it opens instantly |
| `themes.js` | The 7 colour themes. Copy a block to make your own |
| `icons/` | App icons |

The `templates` list in the saved data is reserved for the copy-template feature later.
