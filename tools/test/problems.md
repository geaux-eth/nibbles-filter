# Problem list

Every problem GEAUX has found, written as a kind of mistake rather than one case of it. Each kind has a check that runs
on every test clip (and, for art, on a sample of every Nibble kind and mouth trait), so the same mistake is caught
wherever it shows up next, before GEAUX sees it.

How to use it:
- When GEAUX reports something, add it here first: what he saw, why it happened (the cause, not the symptom), the general
  rule, and a check that fails on the code he used.
- Before anything goes to him: `tools/test/review.sh` (every clip through every check, the made videos as contact sheets
  to look through), `tools/test/vidscore.py` (every made video scored against the pass marks below) and
  `tools/test/nibcheck.mjs` (every Nibble made the way the app makes it and measured, on `tools/test/nibpick.py`'s
  covering sample first, then the whole collection). Nothing ships with a failing score or an unreviewed sheet.
- A check is only trusted once it fails on the version GEAUX complained about: `tools/test/nibvalidate.sh` rebuilds those
  versions (brown teeth, the chip's white box, bow scribbles, drool flashing) and runs the check on them.
- Never tune a number on a held-out clip (office1, office2, sunny). They only measure.

## Who's on screen / who's talking
| # | GEAUX saw | Cause | Rule | Check |
|---|---|---|---|---|
| P1 | A Nibble talking during the audience's laugh (Jerry at 26.5 s) | A listener laughing along read as talking | A short line that's mostly laugh track is nobody's | golden sitcom "laugh at 26–27.7 s" |
| P2 | Elaine's lines start under George (14.5, 39.7 s) | Talking with no lips moving was guessed by pitch, among everyone, even people not in the shot | In a conversation, unseen talking carries on with whoever was talking, or goes where the voice clearly says | golden sitcom "Elaine's lines start with her" |
| P3 | The wrong person on screen generally | Thresholds tuned on one clip | Score every quarter second against an edit of the whole clip, on clips never tuned on | sitcom "GEAUX's edit, all of it"; held-out clips' score |
| P4 | Off-camera voice confused (turtle reporter, narrator) | Lips misread (face paint) | The voice decides when lips and voice disagree | golden turtle, latarian |
| P5 | People found in the background ("Everyone else") | Bystanders cast | Only people with shots of their own; everyone else only in songs | golden sitcom, panels |
| P6 | (found by the review, 21 Nov) A cut to the main person for a moment between two others' lines | A pause over 1 s went back to the main person even when the next line started right after | No one is on screen for a flash: a pause under 2 s before the next line stays on whoever spoke | every clip: "no one on screen for a flash" |
| P7 | (held-out clips, 21 Nov) Talkers never cast (Office meeting: Oscar, Jim, Michael; Sunny's waitress) | Casting was by faces alone; people with only short or shared shots weren't featured | Voices first: every distinct voice gets a person; a voice with no Nibble is matched to the face seen talking while it's heard | held-out scores (office1 62% → 95%) |
| P9 | (22 Nov, Frank clip) The main speaker's lines given to a silent listener | Two of Frank's voice groups compared on lips alone, so a short group (the next speaker starting over the cut) beat his whole voice; and a silent person took his off-camera lines as 'parts where they're on screen' | A voice moves off a person only when the other's lips go with it nearly as well, weighed by how much of it there is; when the voices clearly say who talks, a silent person takes nothing | held-out frank 94%; flash check |
| P8 | Who talks when was lips first, voices as a fix-up | Lips mislead (listeners' lips, close voices); the voice step only patched | Group the voices first (no faces), then name each voice by the lips; lips overrule only a rough voice match | sitcom talking 98%, held-out 95 / 86 / 100% |

## Mouths
| # | GEAUX saw | Cause | Rule | Check |
|---|---|---|---|---|
| M1 | Mouths moving to music, horns, laughter | Loudness alone opened the mouth | Only a voice opens a mouth; a show's theme music isn't a voice; a laugh track isn't | made video: open with no voice near (<3%); opening music; laughs (laughmouth.py) |
| M2 | Too much full-teeth mouth | Lip sync's long B mapped to teeth, and long B is mostly non-speech | No shape is shown far more than speech has it; teeth only where speech says EE | made video: teeth under 8% |
| M3 | Drool and tongue flashing between words | The rest face was the Nibble's own big mouth, the talking faces its plain twin's | In a made video, rest and talk come from the same face | sweep: rest vs talk outside the mouth; twinRest set for every big mouth |
| M4 | Gum bubble hides every mouth | The bubble was kept in front | Nothing covers the talking mouth; a big own-mouth trait comes off on the twin's face | sweep (bubble-gum Nibbles) |
| M5 | Fangs and teeth stay in O and OO | Image edits kept them | O and OO never show fangs or teeth | art review of every kit's O/OO |
| M6 | Scribbles, ticks, smudges on clothes or chin around a talking mouth | The reference's own lines (suspenders, a redrawn chin) were carried onto every Nibble | Outside its face, a talking frame is the Nibble's own pixels | sweep: ink changed outside the face |
| M7 | Wooden-puppet drawn mouths | Mouths drawn by code | Mouths come from drawn art (kits), never code-drawn shapes | — (rig.js unused) |
| M9 | (22 Nov) Brown teeth on bears (and other kits); beaver teeth gone in some mouths | My clean-up snapped near-face colours to the face colour, turning cream fangs muzzle-tan; and the 'teeth go in O/OO' rule (GEAUX's, for the wolf's fangs) was applied to the beaver, whose buck teeth are the beaver | Clean-ups never touch tooth-white; a rule GEAUX gives for one kind is checked against what each kind is before it's applied to all | tools/test/teeth_check.py (fails on the art he had: 20 frames) |
| M10 | (22 Nov) 'Getting Gecko ready' for someone never on screen | Look-alikes made ready for every person found, even those with no lines | Nothing is made ready for someone with no lines | — |
| M11 | (23 Nov, found by the made-video score) Mouths 'mumbling': the small open mouth 60-77% of the talking, changing 4 times a second | Lip sync's commonest shapes (B and C) both mapped to the small open mouth, and nothing followed the syllables | Mouths move with the speech's rhythm: shut in the dip between syllables, wide on a syllable's peak against the speaker's own loudness | vidscore.py: mumbling 60% or less, moving 5+ a second (fails on the old videos: 7 of 8) |
| M12 | (23 Nov, found by the nibble check) Beavers barely open their mouths | Every beaver but the reference's outfit had its AH and L swapped for the small open mouth (1/7 of the AH), for collar scraps that the kit engine no longer makes | A fix that hides a shape is re-checked when the cause is fixed; every Nibble's AH opens at least half as wide as its kit's | nibcheck.mjs noOpen |
| M13 | (23 Nov, found by the nibble check) The broken-tooth beaver: a brown box with black edges under the chip | The chip was cut where the kit picture's tooth is, but each talking picture's tooth sits a few pixels off it, and the clear parts of a talking picture let the whole tooth show through | Art edits are measured on each picture they change, not on the kit picture | nibcheck.mjs boxEdge (fails on the old kit) |
| M14 | (23 Nov, found by the nibble check) Doubled, scribbly mouth lines on Nibbles that talk from a twin's face (ghosts most) | Where the kit's mouth left a gap, the twin's own pixels showed, so the twin's frown line sat a few pixels from the kit's | A twin's own mouth is removed like the Nibble's own: its line pixels take the twin's skin beside them | nibcheck boxEdge (ghosts 13/33 to 21/33 passing) |
| M15 | (23 Nov, found by the nibble check) Straight cut edges and smudges at the same spot on every Nibble of a kind | The image tool redrew things outside the mouth in the talking pictures (eyes, chin, collars), and the kit engine copied them | Outside the mouth, a talking picture is its kit picture: tools/kit_trim.py puts back every change not touching the mouth | nibcheck boxEdge, grouped by kit and spot |
| M8 | Lip sync not matching the words | Mouth shapes from loudness | Shapes from the speech sounds (Rhubarb) | made video checks |

## Picks and art
| # | GEAUX saw | Cause | Rule | Check |
|---|---|---|---|---|
| A1 | Two robots; two wolves for two people | Random picks with no variety rule | Each person a different kind; one robot at most | castmix.mjs |
| A2 | Boy Nibbles for women | No reading of man/woman | Women get girl Nibbles, men don't | castmix.mjs |
| A3 | Bubble-gum Nibble picked | Not excluded | Never picked automatically; plain mouths first | castmix.mjs |
| A6 | (review, 21 Nov) A drooling built-in and a fan-covered mouth picked from the built-in list; picks ignored mouths | The built-in list picked before the trait list had loaded | The trait list loads before any pick; a covered mouth is never picked; a big own mouth with no twin rests shut | review sheets |
| A4 | Old background inside outlines (gecko tail gap) | Background cut by flood fill from the edge | Every closed gap of background colour is cut | M15 scan |
| A5 | Robot bear not animated, missing from thumbnail | Lights not loaded; thumbnail framing | Every special trait animates and shows in its thumbnail | fxshot, thumbt |

## Process
| # | GEAUX saw | Cause | Rule |
|---|---|---|---|
| X1 | The same kinds of problems coming back | Checks were written only for what he'd reported, on one clip, and art was looked at for a handful of Nibbles | This list; held-out clips; the art sweep; review of every made video before he sees it |
| X2 | Instructions unclear | — | Tell him exactly what to do, in steps, once |
