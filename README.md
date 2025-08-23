<div align="center">
	<h1 align="center"><b>UoG Degree Classification Calculator</b></h1>
</div>

<br/>

<p align="center">
<a href="https://github.com/CompEng0001/DegreeClassificationCalculator/actions">
  <img src="https://img.shields.io/github/actions/workflow/status/CompEng0001/DegreeClassificationCalculator/pages.yml?branch=main&label=build&logo=githubactions&style=for-the-badge"
       alt="Build status badge">
</a>
<a href="https://github.com/CompEng0001/DegreeClassificationCalculator/deployments">
  <img src="https://img.shields.io/github/deployments/CompEng0001/DegreeClassificationCalculator/github-pages?label=pages&logo=github&style=for-the-badge"
       alt="GitHub Pages deployment badge">
</a>
<a href="LICENSE">
  <img src="https://img.shields.io/github/license/CompEng0001/DegreeClassificationCalculator?style=for-the-badge"
       alt="License badge">
</a>
<img src="https://img.shields.io/github/last-commit/CompEng0001/DegreeClassificationCalculator?style=for-the-badge"
     alt="Last commit badge">

</p>

A lightweight web app to estimate UoG degree classifications from module **marks** and **credits**, supporting **Undergraduate**, **Integrated Masters**, and **Masters** schemes.

**Live site:** https://compeng0001.github.io/DegreeClassificationCalculator/home.html

---

## Features
- Fast, client-side calculation 
- UG (20/80 vs 10/90 auto-select), IM (20/80 L6/L7), and Masters (L7 avg)
- Duplicate module code detection, credit caps, KPI tiles & explanations
- Accessible dark UI; keyboard navigation, skip link, live regions
- No tracking; optional cookie for persistence
- Export and import data from json if needed

---

## Getting Started

### Run locally
```bash
git clone https://github.com/CompEng0001/DegreeClassificationCalculator.git
cd DegreeClassificationCalculator
```
Open `home.html` in a browser to view the app.

---

## Privacy & Cookies

- The app can optionally store your inputs in a local cookie (disabled by default; toggle in the UI).

- No data leaves your browser. See `index.html` and `js/main.js` for details.

---

## Accessibility

- Landmarks: `<header>`, `<main>`, `<footer>`

- Skip link to main content

- Live regions for dynamic KPIs/warnings

- Visible focus styles and sufficient contrast

---

## License

[MIT](./LICENSE.md)

---

## Author

- [CompEng0001](https://github.com/CompEng0001)