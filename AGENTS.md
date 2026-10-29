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

- Keep paper-exam grounding and evidence retrieval in dedicated modules; online exam generation and lesson retrieval remain unchanged to prevent cross-feature regressions.
- Verify paper citations against retrieved excerpts and derive source labels from stored metadata; AI-supplied source names and page numbers are never trusted.
