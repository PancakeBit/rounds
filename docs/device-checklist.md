# Rounds: device checklist

Updated 2026-10-12 after the first device run. Changes from that feedback: plain numbers with no currency, an "Extra" per person, several nights open at once, the "Someone paid" wording, Settle up at the very bottom, and press animations. Amounts below are plain numbers.

## Setup

1. Install over the old version: `~/Android/Sdk/platform-tools/adb install -r dist/rounds.apk`. It must install over the old one, not fail with a signature mismatch. Old nights must still be there, with the same balances.
2. Home: slate and chalk, no gear icon, and a "Start a night" button that is always there.
3. **Press feel:** tap anything. It sinks at once, springs back with a small bounce, and a ring bursts outward and fades. You feel a light tick on every touch.
4. Crew: add Jo, Sam, Kai and Mia. Shuffle a face, rename one, retire one, then bring them back.

## A full night

5. Start a night: tap the name under **Name the night** (it says e.g. `Monday night`). The whole name selects, so typing replaces it. Type `Karaoke outing!`. Pick Jo, Sam and Kai. The line-up now has a **Group shot** tile at the start too. Snap Jo and Sam, leave Kai, take a start group shot, and tap Done.
   - **Check:** are the front-camera photos mirrored or rotated compared with the preview?
6. The night screen: the top bar reads `Karaoke outing! ✎`. Tap it → "Name the night" box, change it to `Kai's birthday outing!`, Save. The top bar updates; back on Home it shows the new name too. Cancel leaves it alone, and Save is greyed out when the box is empty. The bottom panel has **Someone paid**, then **Settle up** below it with a clear gap. The top row has Faces, Add someone and Recap.
7. Tap Someone paid for each of these, and check the columns after each one.
   1. Jo pays `30`, Drinks, everyone at 1 → Jo `+20.00`, Sam `-10.00`, Kai `-10.00`. Each digit pops as you type it.
   2. Type `9999999.99`: the amount shrinks to fit and doesn't overflow. Clear it.
   3. Sam pays `10`, everyone at 1 → the preview reads `3.34 / 3.33 / 3.33`.
   4. **One extra item:** Kai pays `60`. Tap **+ Extra** on Sam and set `15`. Everyone stays at 1 → Sam `30.00`, Jo `15.00`, Kai `15.00`. The line under the list reads "Extras 15.00 · the other 45.00 split between 3".
   5. **Different orders:** Jo pays `100`. Set extras Jo `30`, Sam `20` and Kai `10`, with everyone at 1 → Jo `43.34`, Sam `33.33`, Kai `23.33`. The leftover 40 is split evenly.
   6. **Only their own thing:** with an extra on Sam, press − on Sam until it shows 0 → Sam pays only their extra.
   7. Sam pays `12` with **On me** → balances don't change, and the item shows a circled ON ME.
   8. Jo pays `8` and taps **For Sam** → the other shares drop to 0, and Sam shows `100%`.
8. Edge cases on that screen:
   - With "For Sam" lit and Jo paying, switch the payer to Sam → everyone goes back to 1.
   - Extras adding up to more than the bill → "Extras add up to more than the bill", and Save is disabled.
   - Every share at 0 with no extras → "Nobody is sharing the rest".
   - Tap **+ Extra**, then **No extra** → the extra is cleared.
   - Double-tap Save → only one item is created.
   - **What for, several:** tap Drinks and Food → both light up. Tapping the only lit one does nothing (one must stay). Save → the feed shows 🍺🍔 and "Drinks & Food" when there's no note.
   - **By item.** Someone paid → Jo paid, type `20`, note `Dinner`, then tap **Break it into items**. The keypad goes. The first row reads `Dinner 20.00` and there's a blank row under it. The keyboard stays down. The kicker now says TOTAL.
     1. Fill the blank row: `Beer` `15`. Tap Jo twice (chip shows `×2` in Jo's colour), then Sam once. Add an item: `Steak` `24`, tap Kai. Leave Dinner unclaimed: its **Everyone** chip is lit and it says "Shared by everyone · tap names if only some had it".
     1b. Every name chip is in that person's colour, even unclaimed; a claimed chip fills with the colour. Under Beer: `Jo 10.00 · Sam 5.00` with coloured names. Under Dinner (once it has a price): `Shared by everyone · 6.66–6.67 each`.
     1c. **Scrolling:** with the list long enough to scroll, fill in a price, then tap **+ Add item**. The screen scrolls so the new row sits near the top, and the keyboard opens on its name. It must not jump to the top of the screen.
     2. Service / tax / tip `5.90`. TOTAL reads `64.90`. Who owes what shows Jo, Sam and Kai with amounts that add up to 64.90, and Kai's is the biggest. Under each name is what it's made of, e.g. Jo: `Dinner (shared) 6.67 · Beer (×2) 10.00 · Service …`.
     3. Hold Sam's chip on Beer → Sam comes off. Tap Kai on Dinner → only Kai has it and Everyone goes dark. Tap **Everyone** → back to shared by everyone.
     4. Tap + Add item and leave it blank → Save still works (blank rows are skipped). Type `Chips` but no price → "Chips needs a price" in red and Save is greyed out, but the TOTAL and Who owes what keep showing the other items. Claim someone on a blank row without typing anything → "An item needs a price".
     5. Save. The feed row says `Jo paid · 3 items`. Tap it → the items, claims and service come back as you left them. Change Steak to `26` and save: the balances move.
     6. Hold it to remove, then Undo → it comes back with its items (open it and check).
     7. Open it again. Removing the blank row at the bottom does nothing special. Remove real items with × until one real item is left → it turns back into a plain split: the keypad returns with that item's price plus the service as the amount.
     8. Recap → The receipt shows Dinner as `Jo paid · by item`, with each item and who had it underneath. Send as text has the items too, indented, with each person's amount (`Beer 15.00 · Jo ×2 10.00, Sam 5.00`). Tick **Show who had what** above the receipt → a "Who had what" section appears: each person in their colour, their total, and what it's made of (items, "Dinner service", plain payments by name, treats marked "(on me)"). The totals add up to the TOTAL. Send the receipt and Send as text both include it; untick and they don't. It's off again when you reopen the recap.
     9. Extras first: type `20`, give Sam an extra of `20`, tap Break → one row `Sam's extra 20.00` claimed by Sam, plus a blank row. No error.
9. Tap an item, change it to `36` and save: the balances update. Hold an item: chalk strike, it's removed, and "Removed · Undo" appears **above** the bottom panel. Tap Undo and it comes back.
10. **Late arrival:** Add someone → Mia. Her column reads `0.00 square`, and new items include her.

## Several nights open

11. Go back to Home. "Still open" shows tonight with what's still unpaid. Tap **Start a night** and start a second one with Jo and Mia. Home now lists both.
12. Log something on the second night. Go back: each open night shows its own unpaid figure.

## Settle up and the finish

13. On the first night, tap Settle up. Each row reads `Jo pays Sam`, with each name in that person's colour and both avatars (payer on the left, payee on the right). Scoreboard column names are in their colours too. The transfers clear the scoreboard balances. Tick one: the big number gets a strike and the next one drops in.
14. Leave it half-ticked, kill the app, and reopen it. The night is still under Still open, and the ticks are kept.
15. Tick the rest, then **Close the night** → ALL SQUARE, chalk dust, two haptic thunks. The night moves to Past nights, and the other night stays open.
16. Recap has two tabs.
    - **The receipt:** every item with who paid (in their colour) and how it was split, the TOTAL, then Who owes who with paid rows struck and marked PAID, and the three titles. **Send the receipt** sends a complete, legible image. **Send as text** shows extras as `Sam +15.00`.
    - **The photos:** a collage of the start faces, the group shots and the end faces. **Shuffle the layout** cycles through every layout that fits. Check each one for clipped or overflowing photos and text, then **Send the photos** and check the image.
    - Photo combinations to try, using a fresh night each time (hold a photo on Faces to remove it):
      - no photos at all → "No photos from this night" with a Take some button
      - one face only
      - only the end group shot
      - start and end faces, no group shot
      - both group shots and no faces
      - everything
    - The same night always opens on the same layout, and different nights open on different ones.
17. A past night is read-only: no bottom panel and no Add someone. Its name can still be changed from the top bar.

## Phone settings

18. **Navigation bar:** with 3-button navigation and again with gestures, nothing sits under the bar. That covers the bottom panel, the Undo bar, the camera shutter, and the last button on each scrolling screen.
19. **Remove animations** (Accessibility): taps still give the haptic but don't sink or ring, rows appear without dropping in, and ALL SQUARE has no dust.
20. **Camera denied:** run `adb shell pm revoke com.joshua.rounds android.permission.CAMERA`, then tap a face → the "needs the camera" screen, and Skip works.
