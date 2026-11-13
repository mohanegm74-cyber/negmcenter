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
- Keep exam formatting, adapters, pagination and exports in browser-safe dedicated modules that consume existing exam data without generating or altering questions, answers or scores; store format presets locally per signed-in teacher and grade family.
- Verify paper citations against retrieved excerpts and derive source labels from stored metadata; AI-supplied source names and page numbers are never trusted.
- Keep contest speech in dedicated authenticated modules, separate from assistant speech, so pronunciation changes cannot regress assistant behavior.
- Student finance summaries use a dedicated browser-safe helper mirroring teacher monthly-ledger rules (recorded charges or academic defaults, then payments/exemptions); settlement derives from all-month remaining to keep both views consistent.
- Group-list filtering and print sizing stay in a dedicated browser-safe helper; print styles and fit-to-page behavior apply only to group lists to preserve other documents.
- Exam-tab grade/group filtering stays in a dedicated browser-safe helper: an exam matches when its grade matches or is unset and its group matches or is unset (all-groups exam), while a student result matches the student's own grade and group.
