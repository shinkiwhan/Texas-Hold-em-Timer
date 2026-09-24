# Tournament Modes Design

## Goal

Add two immutable tournament modes selected when a new online room is created:

- **Daily**: preserve the current 7-minute blind structure exactly.
- **Satellite**: use 10-minute blind levels, no ante, and a chip-friendly structure whose big blind rises by roughly 20–50% per level. Insert a 5-minute break after every five blind levels.

The central timer, participant page, room recovery, rebuy cutoff controls, and persisted timer state must all use the room's selected mode.

## User Flow

1. The administrator presses **새 게임 방**.
2. A custom in-app dialog presents two large choices:
   - **데일리 · 7분**
   - **새틀라이트 · 10분**
3. Selecting a mode creates the room immediately with that mode.
4. The selected mode is displayed on the central room panel and participant page.
5. The mode cannot be changed after room creation. The administrator must end the room and create another to choose a different mode.

If the administrator already has an active room, the existing confirmation appears first. Mode selection follows only after confirmation.

## Shared Mode Profiles

`poker-core.js` will expose immutable profiles instead of a single `LEVELS` array:

```text
PokerCore.MODES.daily
PokerCore.MODES.satellite
PokerCore.getMode(modeId)
```

Each profile contains:

- stable `id`
- Korean label
- blind level duration
- ordered stages including breaks

Unknown or missing mode IDs resolve to `daily` for backward compatibility.

### Daily Profile

The current 17-stage structure remains unchanged, including 7-minute blind levels and its existing 5-minute breaks.

### Satellite Profile

All blind levels last 10 minutes. Breaks last 5 minutes. There is no ante.

| Blind level | Small / Big blind |
|---:|---:|
| 1 | 100 / 200 |
| 2 | 200 / 300 |
| 3 | 200 / 400 |
| 4 | 300 / 500 |
| 5 | 300 / 600 |
| Break | 5 minutes |
| 6 | 400 / 800 |
| 7 | 500 / 1,000 |
| 8 | 600 / 1,200 |
| 9 | 800 / 1,600 |
| 10 | 1,000 / 2,000 |
| Break | 5 minutes |
| 11 | 1,200 / 2,400 |
| 12 | 1,500 / 3,000 |
| 13 | 2,000 / 4,000 |
| 14 | 2,500 / 5,000 |
| 15 | 3,000 / 6,000 |
| Break | 5 minutes |
| 16 | 4,000 / 8,000 |
| 17 | 5,000 / 10,000 |
| 18 | 6,000 / 12,000 |
| 19 | 8,000 / 16,000 |
| 20 | 10,000 / 20,000 |
| Break | 5 minutes |
| 21 | 12,000 / 24,000 |
| 22 | 15,000 / 30,000 |
| 23 | 20,000 / 40,000 |
| 24 | 25,000 / 50,000 |
| 25 | 30,000 / 60,000 |
| Break | 5 minutes |
| 26 | 40,000 / 80,000 |
| 27 | 50,000 / 100,000 |
| 28 | 60,000 / 120,000 |
| 29 | 80,000 / 160,000 |
| 30 | 100,000 / 200,000 |

This progression follows the chip-friendly 1.2x–1.5x big-blind steps commonly seen in published tournament and satellite structures. It is a fixed profile rather than a runtime formula so both clients always show identical values.

## Central Timer Changes

- Replace the global fixed `LEVELS` reference with active mode/profile state.
- Opening the new-room dialog does not reset the current timer. Selecting a mode resets the timer to that profile's first level as part of room creation.
- Loading or recovering a room switches to its stored profile before applying `current_level` and remaining time.
- Local saved timer state includes `mode`; old saved state defaults to `daily`.
- Rebuy cutoff options are generated from blind stages in the active profile. Break stages are excluded, while option values continue to store the underlying stage index used by the database rule.
- Display a compact mode badge in the online room area.
- Starting, pausing, navigating, resetting, elapsed-level catch-up, and room termination retain their existing behavior.

## Participant Changes

- Select the profile from `room.mode` before rendering the current level.
- Show the Korean mode label near the level/timer display.
- Continue deriving remaining time from server timestamps.
- Rebuy availability continues to compare the room's current stage index with its stored cutoff stage.
- Existing rooms with no mode are treated as daily.

## Dialog Changes

Extend `poker-dialog.js` with a choice dialog that accepts a list of labeled choices and returns the selected value or `null` when dismissed. It will reuse the existing overlay, focus restoration, outside-click cancellation, and Escape handling.

The mode dialog will use descriptive buttons rather than a browser prompt:

- `데일리` with `블라인드 7분 · 현재 스트럭처`
- `새틀라이트` with `블라인드 10분 · 완만한 표준 스트럭처`

## Database Changes

Add a migration that:

1. Adds `poker_rooms.mode text not null default 'daily'` with a check constraint allowing only `daily` and `satellite`.
2. Expands `current_level` and `rebuy_until_stage` constraints to permit the longer satellite profile. The supported stage range will be `0..63`, leaving room for future fixed profiles without another immediate constraint migration.
3. Replaces `create_poker_room_with_pin` with a signature accepting `p_mode` and validates the supplied value.
4. Revokes the old function signature and grants the new signature only to authenticated users.

Existing rows automatically become `daily`; no destructive data migration is required.

## Compatibility and Failure Handling

- Missing, null, or unknown client-side mode values fall back to daily.
- The database rejects unknown mode values.
- A room is not created if the administrator dismisses mode selection.
- If room creation fails after selecting a mode, the central timer restores its prior local mode and timer state rather than leaving a partially switched display.
- A recovered room always wins over local saved mode.

## Tests

Node tests will cover:

- both profiles exist and are immutable
- daily profile is unchanged
- every satellite blind duration is 10 minutes
- a 5-minute break follows every five satellite blind levels except after the final group
- satellite big-blind increases remain within 20–50%
- shared blind numbering across breaks
- elapsed multi-level catch-up against each profile
- unknown mode fallback to daily

Static HTML checks will verify both pages load the shared mode/profile API and contain no duplicate blind structures. The migration will be applied to the linked Supabase project, then the deployed GitHub Pages assets and GitHub Actions result will be verified.

## Out of Scope

- BB ante or per-player ante
- prize/ticket calculations or stopping automatically when a target number of seats remains
- changing a room's mode after creation
- custom user-authored structures
- changing the existing daily structure
