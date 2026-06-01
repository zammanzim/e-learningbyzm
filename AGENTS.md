# AGENTS.md

## Project Overview

This project is a web-based e-learning platform built with:

* Vanilla JavaScript
* HTML
* CSS
* Supabase (PostgreSQL)
* Modular JS architecture
* localStorage-based auth/session handling

The project prioritizes:

* simplicity
* consistency
* maintainability
* minimal code changes
* working solutions over over-engineering

---

# VERY IMPORTANT RULES

## DO NOT RUN UNNECESSARY COMMANDS

Avoid:

* `npm run dev`
* `npm start`
* `vite`
* `serve`
* opening browsers
* starting local servers
* running builds
* running tests

UNLESS explicitly requested by the user.

The user will manually test changes themselves.

Do not waste tokens or time executing the project unnecessarily.

---

# CODE STYLE RULES

## Preserve Existing Style

Follow the existing project style exactly.

Do NOT:

* rename variables unnecessarily
* refactor unrelated code
* change formatting style
* reorganize files
* rewrite working systems
* introduce frameworks
* introduce TypeScript
* introduce build tools
* introduce abstractions unless requested

Keep edits minimal and surgical.

---

# JAVASCRIPT RULES

## Prefer Simple Vanilla JS

Use:

* querySelector
* addEventListener
* template literals
* existing utility functions
* existing managers/modules

Avoid:

* classes unless already used
* complex abstractions
* dependency injection
* unnecessary async patterns
* unnecessary helper wrappers

---

# TRANSLATION SYSTEM

The project uses a custom i18n system.

Usage:

```js
t('save')
```

HTML usage:

```html
data-i18n="save"
data-i18n-placeholder="search"
```

Rules:

* never hardcode user-facing text
* always use translation keys
* keep key naming consistent
* prefer snake_case keys
* avoid duplicate keys

---

# UI CHANGES

When editing UI:

* preserve current design
* preserve current spacing/layout
* avoid redesigning components
* avoid changing unrelated HTML/CSS
* avoid introducing new UI systems

Only modify what the user requested.

---

# DATABASE RULES

The project uses Supabase.

Rules:

* avoid schema changes unless requested
* avoid destructive queries
* avoid unnecessary migrations
* prefer compatible incremental changes

---

# PERFORMANCE RULES

Prefer:

* lightweight solutions
* minimal DOM operations
* minimal rerenders
* existing patterns already used in the project

Avoid:

* heavy libraries
* unnecessary observers
* unnecessary polling
* unnecessary animations

---

# FILE EDITING RULES

When editing:

* modify only relevant sections
* preserve comments
* preserve naming conventions
* avoid massive rewrites

If a better architecture exists but requires major rewrites:

* DO NOT implement it
* instead briefly suggest it

---

# RESPONSE STYLE

When providing code:

* explain briefly
* provide concise changes
* avoid long theoretical explanations
* prioritize practical implementation

When unsure:

* ask before making large architectural changes

---

# PROJECT PRIORITIES

Priority order:

1. Preserve existing functionality
2. Minimal code changes
3. Consistency with current codebase
4. Simplicity
5. Performance
6. Scalability

Do not sacrifice existing architecture for theoretical improvements.

---

# DEVELOPMENT PHILOSOPHY

This project intentionally prefers:

* practical solutions
* understandable code
* incremental improvements
* fast iteration

Over:

* enterprise abstractions
* over-engineering
* unnecessary optimization
* unnecessary refactors

Respect the existing architecture.
