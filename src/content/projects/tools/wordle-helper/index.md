---
title: Wordle Helper
description: Wordle solver — enter your guesses, tag tile colors, see remaining candidate answers instantly.
category: tools
status: live
href: /apps/wordle-helper/
featured: true
tags: [wordle, words, helper, game]
created: 2026-06-05
---

Standalone static helper at [/apps/wordle-helper/](/apps/wordle-helper/).

Two input modes:

- **🎯 Guesses** — a Wordle-style 6×5 board. Type letters, then click each tile
  to cycle absent / present / correct. The app folds every colored tile into a
  single constraint set (including exact letter counts when grays and
  greens/yellows of the same letter coexist in one guess) and filters the
  ~12k 5-letter slice of the merged dictionary in real time.
- **🔧 Manual pins** — pin specific letters at specific positions and mark
  letters as required-anywhere or forbidden, like in
  [Word Explorer](/apps/dictionary/).

Possible Wordle solutions are highlighted with a green border and a ★ marker —
hover for a tooltip. Toggle **only show possible solutions** to focus on
likely answers, or **solutions first** to sort them to the top of the larger
list of valid 5-letter words.

The "possible solutions" list is a curated starter set, not exhaustive.
