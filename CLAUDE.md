# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Greenfield project — there is no code, build system, or test suite yet, only documentation. When the first code is added, update this file with the actual build/run/test commands and architecture decisions.

## Game Design

Design decisions live in `docs/conception.md` (in French). It is the source of truth and supersedes the README where they differ: read it before implementing gameplay, and update it whenever the owner settles a design question (each item is tagged Décidé / Proposition / À trancher).

In short: a free-for-everyone (no pay-to-win) multiplayer kingdom-building strategy game, in the same genre as Rise of Kingdoms but with a medieval-fantasy setting (several playable races, magic, dragons). Everything runs in real time with durations (building, research, training, marches), and progress continues while the player is offline, so game state must be derived from timestamps rather than from a loop that only runs while the page is open. All content — name, races, heroes, art — must be original; never reuse Rise of Kingdoms' content.

Platform roadmap: web app first, then packaged as an Android app via Ionic. Prefer a standard web stack (HTML/CSS/JS or a framework compatible with Capacitor/Ionic) so the mobile packaging step stays straightforward.

## Working with the Owner

The project owner communicates in French and is learning to code. Respond in French, explain technical choices simply, and prefer incremental steps over large opaque changes.
