# Engineering portfolio

A static site: no build step, no framework. Edit the HTML files directly and upload the folder to GitHub Pages.

```
index.html                     Home: 3D car, about, skills, projects, other work, contact
projects/*.html                One case-study page per project
assets/css/site.css            All styling (colors and fonts are the variables at the top)
assets/js/car-viewer.js        The 3D header
assets/js/site.js              Draft counter, copy button, footer year
assets/model/car.glb           The car (2.5 MB, Draco-compressed)
assets/model/car-poster.webp   Still image shown while the 3D loads
assets/vendor/draco/           Decoder for the compressed model (leave as is)
```

## Filling in the placeholders

Unfinished spots are short reminders in square brackets, such as `[team role, years on team]`, shown as plain text.

1. In each HTML file, search for `class="ph"`. Replace the whole `<span class="ph">…</span>` with your text. Example: `<span class="ph">[team role, years on team]</span>` becomes `I lead suspension and have been on the team for three seasons.`
2. Image placeholders are `<div class="ph-fig">…</div>`. Put your image in `assets/img/` and replace the div:
   - Home page project rows (4:3): `<img class="entry-thumb" src="assets/img/suspension.webp" alt="What the image shows">`
   - Project pages (16:9): `<img src="../assets/img/suspension-plot.webp" alt="What the image shows">`
   - Export images at about 1600 px wide, as WebP or JPEG, to keep the site fast.
3. Project titles and one-line results are written twice: in the project row on `index.html` and at the top of the project's own page. The 3D markers read their text from the rows on `index.html`, so there's nothing else to update.
4. Résumé: save it as `assets/resume.pdf`.
5. Email: replace `you@example.com` in all three places on that line (the link, the text and `data-copy`).

To make the remaining reminders easy to spot again, uncomment the `.ph` block near the top of `assets/css/site.css` (yellow highlight) and set `SHOW_DRAFT_COUNTER = true` in `assets/js/site.js` (a "placeholders left" counter in the corner of each page).

The strip of three facts under the car and the "Other work" list are both on `index.html`. Other work entries are one-liners on purpose; if one of them grows into a full project (for example with renders from the original SolidWorks files), copy a page in `projects/` as its template.

## Previewing on your computer

The 3D viewer can't run from a double-clicked file, so start a small local server:

1. Open a terminal in this folder.
2. Run `python -m http.server 8000`.
3. Open http://localhost:8000 in your browser.

## Publishing on GitHub Pages

1. Create a GitHub account if you don't have one.
2. Create a new public repository named `<your-username>.github.io`. This gives you the address `https://<your-username>.github.io`.
3. Upload the contents of this folder (not the folder itself) to the repository: on the repository page, choose Add file, then Upload files, and drag everything in, including the hidden `.nojekyll` file. With Git instead: clone the repository, copy the files in, commit and push.
4. In the repository, open Settings, then Pages. Under Build and deployment, set Source to "Deploy from a branch", choose `main` and `/ (root)`, and save.
5. Wait a minute or two, then open `https://<your-username>.github.io`.

To update the site later, upload the changed files again; GitHub redeploys automatically.

## The 3D header

- Markers come from the project rows on `index.html`: a row with `data-car-group="Group_Suspension"` becomes a marker anchored at the `Group_Suspension` Empty in the model. To add a fourth (for example aero), parent the parts to a new Empty named `Group_Aero` in Blender, re-export, and add `data-car-system="aero" data-car-group="Group_Aero"` to that project's row.
- The camera angle for each system is set by `VIEWS` at the top of `assets/js/car-viewer.js` (offsets in meters from the Empty: +X is the car's left, +Y up, +Z forward).
- Links to `index.html#car-suspension` (or `#car-tires`, `#car-steering`) open the page with that system already selected. Each project page's "See it on the car" button uses this.
- If you replace `car.glb`, keep the `Group_` Empty names, and re-render `car-poster.webp` from the default camera so the loading image lines up with the 3D view.
