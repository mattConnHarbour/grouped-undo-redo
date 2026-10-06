# Grouped undo and redo

This local demo explores an application-owned logical undo group for a content-control workflow. It inserts an inline SDT, then unlocks, bolds, and relocks every addressable SDT. The demo records the history-depth delta and routes its Undo button and `Cmd/Ctrl+Z` through an application-owned handler that applies the complete logical group.

```bash
pnpm --dir superdoc/public/examples/grouped-undo-redo dev
```

This is a proof of concept, not native history grouping. Use the demo Undo button or `Cmd/Ctrl+Z`; the built-in toolbar Undo remains a native single-entry undo. Redo is not grouped.
