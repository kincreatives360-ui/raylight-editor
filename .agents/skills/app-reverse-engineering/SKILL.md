---
name: app-reverse-engineering
description: Reverse engineer software applications, perform full technical architecture audits, design phased implementation roadmaps, and build foundational core engines. Use when the user asks to reverse engineer an app, clone or rebuild a software tool, analyze how a product works under the hood, design a system data model, or implement the core architecture of an existing application.
---
# App Reverse Engineering

Deconstruct existing software applications into clear technical architectures, core data schemas, prioritized engineering roadmaps, and runnable foundational code.

## Instructions

### 1. Audit the Underlying Architecture
- Identify what the application is at a systems level rather than just describing surface buttons.
- Break down the primary engine, rendering pipeline (Canvas 2D, WebGL, WebGPU), data parsers, and media handling.
- Map client vs. server responsibilities and document multi-step workflows in a Markdown table.

### 2. Define the Tech Stack and Core Data Schema
- Consult `resources/schema-template.ts` and write complete TypeScript interfaces covering the root project state, scene graph nodes, keyframe interpolation payloads, and timeline blocks before writing UI code.

### 3. Sequence the Build Roadmap Around the Core Engine
1. **Phase 1 (Deterministic Core Engine):** Isolate the pure state evaluation function `evaluate(state, timestampMs)` paired with a single range slider viewport.
2. **Phase 2 (Interactive Manipulation & Data Ingestion):** Add direct canvas manipulation handles, asset loaders, and parsers on top of the working core.
3. **Phase 3 (Editing UI & Specialized Workflows):** Build the timeline tracks, curve editors, and property inspectors that mutate the core state schema.
4. **Phase 4 (Local Processing & Export Pipelines):** Wire up encoding or output generation using the deterministic core from Phase 1.
5. **Phase 5 (Automation, APIs & Collaboration):** Expose the state store and rendering hooks to external agents or templates.

### 4. Deliver Complete, Runnable Code for Each Phase
- Provide exact setup commands, clean module separation, and realistic sample data.
- Never leave `// TODO` or placeholder comments.