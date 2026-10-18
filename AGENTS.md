<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Daily accounting lives in `src/lib/daily-accounting.ts`; sum bank movements before clamping so every screen uses order-independent totals.
- Historical daily goals are database snapshots; settings changes must preserve prior dates so completed history is not rewritten.
- Reconstructed pretracking goals must remain labeled as fallback; never present inferred old settings as verified history.
- Bank and log mutations are validated by serialized database triggers; application checks alone cannot prevent concurrent overdrafts.
- Progress mutations use `refreshProgress` to refresh all dependent views together.
- Calendar tracking uses UTC dates across the app; reminder clock times remain local to the user's browser.
- Critical domain regressions run with `bun test src/lib/*.test.ts`; UI copy and styling are not test assertions.

- Progress read endpoints live in `progress-reads.functions.ts`; mutation endpoints remain in `pushups.functions.ts` to keep accounting views separate from writes.
- Squad creation, joining, and owner departure are transactional RPCs so a user has one principal squad and ownership never becomes orphaned.
- Team metadata requests opt out of statistics; aggregate/paginate history only on statistics surfaces to avoid lifetime work in headers.
