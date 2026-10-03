# 2D Top-Down MMORPG Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the custom engine into a playable 2D Top-Down MMORPG with simulated online world, top-down movement with sliding collision, rich combat, monster AI with leashing, and simulated MMO bots.

**Architecture:** Extend the existing ECS World, GameLoop, InputManager, Camera2D, and AABB collision system. Implement top-down kinematic movement, RPG stats, combat system with critical strikes and active skills, monster state machine with leashing, bot player AI, and depth Y-sorted rendering.

**Tech Stack:** TypeScript (Strict Mode), Vite, HTML5 Canvas 2D API, Vitest

**Spec:** `docs/superpowers/specs/2026-10-03-2d-mmorpg-engine-design.md`

## Global Constraints

- TypeScript Strict Mode enabled (`noImplicitAny: true`, `strictNullChecks: true`, `noUnusedLocals: true`).
- Zero usage of the `any` type across all files.
- Zero external game libraries (pure custom HTML5 Canvas 2D engine).
- Zero em dashes (`—`) in code, comments, and documentation.
- All public functions and classes must have brief JSDoc comments.
- Potential bugs and edge cases must be marked with `// ⚠️ EDGE CASE:`.

## Review Focus

- Diagonal movement speed bug: vector must be normalized to prevent 1.414x speed boost.
- Infinite monster kiting: monster must return to home and heal if pulled beyond leash radius.
- Simultaneous death and EXP reward: dead monster must not award EXP multiple times in consecutive ticks.
- Depth sorting glitch: entities must be drawn sorted by bottom Y coordinate (`y + height`).
- Division by zero on zero-distance chase: AI distance check must guard against zero-length vectors.

---

### Task 1: RPG ECS Components

**Files:**
- Create: `src/rpg/RPGComponents.ts`
- Test: `src/rpg/RPGComponents.test.ts`

**Interfaces:**
- Produces: `StatsComponent`, `CombatComponent`, `NameplateComponent`, `MonsterAIComponent`, `SimulatedPlayerComponent`, `FloatingTextComponent`

- [ ] **Step 1: Write failing unit tests for RPG components**
- [ ] **Step 2: Run test to verify it fails (`npm run test`)**
- [ ] **Step 3: Implement components in `src/rpg/RPGComponents.ts`**
- [ ] **Step 4: Run test to verify it passes (`npm run test`)**
- [ ] **Step 5: Commit changes to git**

---

### Task 2: Top-Down Movement System with Sliding Collision

**Files:**
- Create: `src/rpg/TopDownMovementSystem.ts`
- Test: `src/rpg/TopDownMovementSystem.test.ts`

**Interfaces:**
- Consumes: `TransformComponent`, `VelocityComponent`, `ColliderComponent`, `SolidObstacleComponent`
- Produces: `TopDownMovementSystem`

- [ ] **Step 1: Write failing unit test for diagonal normalization and sliding collision**
- [ ] **Step 2: Run test to verify it fails (`npm run test`)**
- [ ] **Step 3: Implement `TopDownMovementSystem` with per-axis resolution**
- [ ] **Step 4: Run test to verify it passes (`npm run test`)**
- [ ] **Step 5: Commit changes to git**

---

### Task 3: Combat System, Skills, and Leveling Loop

**Files:**
- Create: `src/rpg/CombatSystem.ts`
- Test: `src/rpg/CombatSystem.test.ts`

**Interfaces:**
- Consumes: `StatsComponent`, `CombatComponent`, `FloatingTextComponent`, `TransformComponent`
- Produces: `CombatSystem`

- [ ] **Step 1: Write failing unit test for damage formula, critical hits, skills, EXP, and level-up**
- [ ] **Step 2: Run test to verify it fails (`npm run test`)**
- [ ] **Step 3: Implement `CombatSystem` with cooldowns, floating text spawning, and level-up reset**
- [ ] **Step 4: Run test to verify it passes (`npm run test`)**
- [ ] **Step 5: Commit changes to git**

---

### Task 4: Monster AI System with Leashing

**Files:**
- Create: `src/rpg/MonsterAISystem.ts`
- Test: `src/rpg/MonsterAISystem.test.ts`

**Interfaces:**
- Consumes: `MonsterAIComponent`, `TransformComponent`, `VelocityComponent`, `CombatComponent`, `StatsComponent`
- Produces: `MonsterAISystem`

- [ ] **Step 1: Write failing unit test for Idle, Patrol, Chase within aggro radius, and Leash/Return**
- [ ] **Step 2: Run test to verify it fails (`npm run test`)**
- [ ] **Step 3: Implement `MonsterAISystem` finite state machine**
- [ ] **Step 4: Run test to verify it passes (`npm run test`)**
- [ ] **Step 5: Commit changes to git**

---

### Task 5: Simulated MMO Player System & Chat Event System

**Files:**
- Create: `src/rpg/SimulatedMMOPlayerSystem.ts`
- Create: `src/rpg/ChatSystem.ts`
- Test: `src/rpg/SimulatedMMO.test.ts`

**Interfaces:**
- Consumes: `SimulatedPlayerComponent`, `StatsComponent`, `TransformComponent`, `CombatComponent`
- Produces: `SimulatedMMOPlayerSystem`, `ChatManager`

- [ ] **Step 1: Write failing unit test for bot mob targeting, potion consumption, and chat log**
- [ ] **Step 2: Run test to verify it fails (`npm run test`)**
- [ ] **Step 3: Implement `SimulatedMMOPlayerSystem` and `ChatManager`**
- [ ] **Step 4: Run test to verify it passes (`npm run test`)**
- [ ] **Step 5: Commit changes to git**

---

### Task 6: MMORenderSystem & Level Integration

**Files:**
- Create: `src/rpg/MMORenderSystem.ts`
- Modify: `src/main.ts`
- Test: `src/rpg/MMORenderSystem.test.ts`

**Interfaces:**
- Consumes: All RPG components, Camera2D, CanvasRenderingContext2D
- Produces: Playable 2D Top-Down MMORPG in browser

- [ ] **Step 1: Write unit test for Depth Y-Sorting algorithm**
- [ ] **Step 2: Implement `MMORenderSystem` with depth sorting, nameplates, healthbars, damage popups, and chat HUD**
- [ ] **Step 3: Wire all systems in `src/main.ts` with open-world map, monsters, NPC players, and player controls**
- [ ] **Step 4: Run all unit tests and production build (`npm run test && npm run build`)**
- [ ] **Step 5: Commit and push to GitHub repository**
