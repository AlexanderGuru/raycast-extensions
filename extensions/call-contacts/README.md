# Call Contacts

Search your macOS **Contacts** and place a call in two keystrokes. The default
action opens a `tel:` link, so the call is placed through your **iPhone** via
Continuity (a regular cellular call). FaceTime Audio/Video and Messages are
available as secondary actions.

## Features

- **Search by anything** — name, organization, phone label, or any part of a
  number (including the middle digits).
- **One keystroke to call** — `Enter` places the call via your iPhone.
- **Dial any number** — type a number that isn't in your contacts and call it
  directly from the search bar.
- **Smart sorting** — frequently called contacts rise to the top
  (with a Reset Ranking action if you want to undo that).
- **Contact photos** — real thumbnails from your address book, cached on disk;
  colored initials avatars as fallback.
- **Fast** — contacts are read in a single CNContactStore pass without
  launching the Contacts app; ~500 contacts load in about a second.
- **Private** — everything stays on your Mac: no accounts, no network calls.

## Actions

| Action | Shortcut |
| --- | --- |
| Call via iPhone | `Enter` |
| FaceTime Audio / Video, Send Message | `Cmd+K` menu |
| Open in Contacts | `Cmd+O` |
| Copy Number | `Cmd+C` |
| Copy Name | `Cmd+Shift+C` |
| Refresh Contacts | `Cmd+R` |
| Reset Ranking | `Cmd+K` menu |

## Requirements

- macOS with the **Contacts** app set up.
- The first launch asks for permission to access Contacts
  (System Settings → Privacy & Security → Contacts → Raycast).
- For real phone calls: an **iPhone** signed into the same Apple ID with
  *Settings → Phone → Calls on Other Devices* enabled — this is what makes
  `tel:` ring out. Without it, the link falls back to FaceTime.

> Note: an active iPhone Mirroring session occupies the same Continuity
> channel and will interrupt calls — close it before calling.
