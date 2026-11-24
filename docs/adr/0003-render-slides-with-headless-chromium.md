# Slides are HTML and CSS templates rendered to PNG and PDF by headless Chromium

Status: accepted

Each slide is an HTML template rendered by Playwright in headless Chromium, which gives pixel-accurate typography, themes, icons, and logo placement. We rejected canvas or image-library rendering because themes and styling tokens would have to be rebuilt in code for each one. The cost is a large Chromium download, accepted once and reused. Rendering runs only for Posts with carousel rendering on.
