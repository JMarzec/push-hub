# Mobile monthly squad chart

## What will change
- Keep one section per squad member, with their name and monthly rep total at the top.
- Stack the three summaries underneath as separate, clearly labeled rows: streak, recovery days, and days on target.
- Replace the compressed 30-bar strip with a fixed-width, horizontally scrollable timeline so every daily bar remains readable.
- Add a shared date axis to each member timeline, using compact day/month labels at useful intervals and an accessible label for every day.
- Preserve the existing target-met, partial, recovery, and missed color meanings and the current desktop styling.

## Mobile behavior
- The timeline starts near the newest dates and can be swiped horizontally to revisit earlier dates.
- Member details remain fixed and readable while only the dated chart scrolls.
- Scroll containers will have stable dimensions and no page-width overflow.

## Verification
- Check the Squad page at phone and desktop widths.
- Confirm date labels, bars, summaries, and the bottom navigation do not overlap or clip.
- Confirm the app builds without errors.

## Technical details
- Update only the monthly chart presentation component.
- Derive compact date labels from the existing `monthDays` dates; no data or calculation changes.
- Use semantic design tokens and existing typography/colors.
