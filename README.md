# kivozo.com

A home for small, fun, and useful things on the web.

## Charter

kivozo.com is meant for:

- 🎮 **Games** — small browser games and toys
- 🛠️ **Fun tools** — utilities that are interesting or playful
- 📚 **Dictionaries** — word lists, glossaries, lookup tools
- 🔧 **Utilities** — practical helpers and converters
- 🧪 **Experiments** — prototypes, demos, things to learn from
- 🎲 **Random projects** — whatever else seems worth building

The site is intentionally broad: a personal sandbox for shipping ideas.

## Repository structure

> Proposed layout — see `docs/architecture.md` (TBD) for discussion.

```
/
├── site/           # Landing page + shared layout (homepage, index of projects)
├── projects/       # Each subproject lives in its own folder
│   ├── games/
│   ├── tools/
│   ├── dictionaries/
│   └── experiments/
├── shared/         # Shared styles, components, assets
└── docs/           # Notes, decisions, charter
```

Each project under `projects/` is self-contained and can be built/deployed
independently or as part of the larger static site.

## Status

🚧 Just initialized. Picking hosting + framework next.

## License

TBD
