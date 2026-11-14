# skins (local fork)

Forked from [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) 0.5.16, MIT, © hellosverre.

Local changes:

- `hooks/command.ts`: `DEFAULT_PREFS.band` is `false` instead of upstream's `true`, so the usage band above the prompt is off by default. The band is not removed: `/skin band on` turns it on, and `/skin band off` turns it off again.

To take a later upstream release, copy its files over this folder and re-apply that one default.
