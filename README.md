# Saideep Tiku Personal Website

Static personal website for saideeptiku.github.io, including home, research, talks, publications, patents, and contact pages.

## Tech Stack

- HTML/CSS (static site)
- Vanilla JavaScript for theme switching and citation map behavior
- Leaflet for interactive citation geography map
- Python script for rebuilding citation map data from OpenAlex

## Project Structure

```
.
├── index.html
├── research.html
├── publications.html
├── patents.html
├── talks.html
├── contact.html
├── styles.css
├── assets/
│   ├── citation-map.js
│   ├── citation-map-data.js
│   ├── theme.js
│   ├── saideep-tiku-headshot.jpeg
│   └── saideep-tiku-cv.pdf
└── tools/
    └── build_citation_map_data.py
```

## Run Locally

Because this site uses browser JavaScript and local assets, run it through a local HTTP server instead of opening files directly when possible.

1. From the repository root, start a server:

```bash
python3 -m http.server 8000
```

2. Open in your browser:

- http://localhost:8000/index.html
- http://localhost:8000/research.html

## Update Citation Map Data

The research page map and Top Countries list are powered by generated data in assets/citation-map-data.js.

1. Run the generator from the repo root:

```bash
python3 tools/build_citation_map_data.py
```

2. Script output:

- Updates public aggregate data: assets/citation-map-data.js
- Updates internal detailed records: .internal/citation-affiliations.json

3. Commit updated files:

```bash
git add assets/citation-map-data.js .internal/citation-affiliations.json
git commit -m "Refresh citation map data"
```

## Theme Behavior

Theme logic is in assets/theme.js.

- Modes: light, dark, auto
- Auto mode resolves by local browser time
- User preference is saved in localStorage under site-theme-mode

## Deploy

This repository is intended for GitHub Pages deployment from the main branch.

Typical workflow:

```bash
git add .
git commit -m "Update site"
git push origin main
```

## Notes

- Citation counts and geography are based on public OpenAlex metadata.
- Some citing works may not expose mappable affiliation data.
