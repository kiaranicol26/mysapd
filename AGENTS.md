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

- Keep appearance colors in semantic tokens in `src/styles.css` and theme persistence in `src/lib/theme.ts`; legacy color utilities map to those tokens so existing views stay consistent.
- Section visibility is stored per instructor and re-read on every server data request, so Alto Mando permission changes apply without waiting for sessions to expire.
