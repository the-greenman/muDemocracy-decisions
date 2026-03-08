# Web Prototype

Simple projection-friendly interface prototype for Decision Logger.

## Run locally

From repo root:

```bash
cd apps/web-prototype
python3 -m http.server 4173
```

Then open:

`http://localhost:4173`

## Design goals

- High contrast for projector visibility.
- Large text and large targets for ease of use.
- Candidate-first flow: pick candidate -> choose template on candidate screen -> generate initial draft -> decision workspace.
- Manual fallback: candidate -> create decision -> segment selection.
- Create Decision includes `AI suggest segments` from title + summary, followed by human review.
- Promoting enters a Decision Workspace with template selection, initial draft generation, field locking/regeneration, and zoomed field editing.
- Transcript hidden by default and only used in segment selection.
- Segment selection supports long meetings (search, sequence range, pagination).
- Segment selection supports mouse/touch drag selection across rows.
- Overlap markers show segments already linked to other candidates.
- Icon-first controls to reduce visual clutter.
- Mobile-safe layout fallback for smaller screens.
