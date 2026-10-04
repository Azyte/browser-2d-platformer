import { describe, it, expect } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import {
  sortEntitiesByDepth,
  calculateHealthBarWidth,
  formatChatTimestamp,
  calculateChatBoxBounds,
  calculateActionBarBounds,
  calculateMinimapBounds,
  calculateQuestTrackerBounds,
  calculateDialogueModalBounds,
  calculateInventoryModalBounds,
  calculateShopModalBounds,
  calculateStageHUDCardBounds,
  calculateStageBannerBounds,
  checkRectOverlap,
  MMOVisualComponent,
} from './MMORenderSystem';

describe('MMORenderSystem - Depth Y-Sorting & HUD Helpers', () => {
  it('should sort entities in ascending order of their base Y coordinate (feet position)', () => {
    const world = new World();

    // Entity A: Tree at y=200, height=80 -> base Y = 280
    const tree = world.createEntity();
    world.addComponent(tree, new TransformComponent(100, 200));
    world.addComponent(tree, new MMOVisualComponent({ width: 64, height: 80, visualType: 'tree' }));

    // Entity B: Player behind tree at y=170, height=32 -> base Y = 202
    const playerBehind = world.createEntity();
    world.addComponent(playerBehind, new TransformComponent(100, 170));
    world.addComponent(
      playerBehind,
      new MMOVisualComponent({ width: 32, height: 32, visualType: 'player' })
    );

    // Entity C: Monster in front of tree at y=270, height=30 -> base Y = 300
    const monsterInFront = world.createEntity();
    world.addComponent(monsterInFront, new TransformComponent(120, 270));
    world.addComponent(
      monsterInFront,
      new MMOVisualComponent({ width: 32, height: 30, visualType: 'slime' })
    );

    const sorted = sortEntitiesByDepth(world, [monsterInFront, tree, playerBehind], 1.0);

    // Expected order: playerBehind (baseY 202) -> tree (baseY 280) -> monsterInFront (baseY 300)
    expect(sorted).toEqual([playerBehind, tree, monsterInFront]);
  });

  it('should support render interpolation alpha when calculating base Y', () => {
    const world = new World();

    // Entity moving downwards: prevY = 100, y = 200, height = 20
    const moving = world.createEntity();
    const transform = new TransformComponent(50, 200);
    transform.prevX = 50;
    transform.prevY = 100;
    world.addComponent(moving, transform);
    world.addComponent(moving, new MMOVisualComponent({ width: 20, height: 20 }));

    // Static entity at y = 160, height = 20 -> base Y = 180
    const staticEnt = world.createEntity();
    world.addComponent(staticEnt, new TransformComponent(50, 160));
    world.addComponent(staticEnt, new MMOVisualComponent({ width: 20, height: 20 }));

    // At alpha = 0.0: moving entity renderY = 100 + 20 = 120 (behind staticEnt 180)
    const sortedAtAlpha0 = sortEntitiesByDepth(world, [staticEnt, moving], 0.0);
    expect(sortedAtAlpha0).toEqual([moving, staticEnt]);

    // At alpha = 1.0: moving entity renderY = 200 + 20 = 220 (in front of staticEnt 180)
    const sortedAtAlpha1 = sortEntitiesByDepth(world, [staticEnt, moving], 1.0);
    expect(sortedAtAlpha1).toEqual([staticEnt, moving]);
  });

  it('should clamp health bar width percentage between 0 and max width', () => {
    const barMaxWidth = 40;

    // Full HP
    expect(calculateHealthBarWidth(100, 100, barMaxWidth)).toBe(40);

    // Half HP
    expect(calculateHealthBarWidth(50, 100, barMaxWidth)).toBe(20);

    // Overkill / Zero HP
    expect(calculateHealthBarWidth(0, 100, barMaxWidth)).toBe(0);
    expect(calculateHealthBarWidth(-15, 100, barMaxWidth)).toBe(0);

    // Overhealed HP clamped to max
    expect(calculateHealthBarWidth(150, 100, barMaxWidth)).toBe(40);

    // Edge case: maxHp <= 0
    expect(calculateHealthBarWidth(50, 0, barMaxWidth)).toBe(0);
  });

  it('should format chat timestamp in HH:MM format', () => {
    // 10:05:00 UTC
    const date = new Date(2026, 9, 3, 14, 5, 0);
    const formatted = formatChatTimestamp(date);
    expect(formatted).toMatch(/^\d{2}:\d{2}$/);
  });

  it('should calculate HUD layout bounds without overlapping elements on 800x480 viewport', () => {
    const vw = 800;
    const vh = 480;

    const chatBounds = calculateChatBoxBounds(vw, vh);
    const actionBounds = calculateActionBarBounds(vw, vh);
    const minimapBounds = calculateMinimapBounds(vw);
    const questBounds = calculateQuestTrackerBounds(vw, 2);

    // ChatBox and ActionHotbar must never collide horizontally or vertically
    expect(checkRectOverlap(chatBounds, actionBounds)).toBe(false);
    expect(chatBounds.x + chatBounds.w).toBeLessThan(actionBounds.x);

    // Minimap and QuestTracker must never collide vertically and must share right alignment
    expect(checkRectOverlap(minimapBounds, questBounds)).toBe(false);
    expect(minimapBounds.y + minimapBounds.h).toBeLessThan(questBounds.y);
    expect(minimapBounds.x + minimapBounds.w).toBe(questBounds.x + questBounds.w);

    // All HUD elements must reside completely inside the viewport bounds
    expect(chatBounds.x).toBeGreaterThanOrEqual(0);
    expect(chatBounds.y + chatBounds.h).toBeLessThanOrEqual(vh);
    expect(actionBounds.x).toBeGreaterThanOrEqual(0);
    expect(actionBounds.x + actionBounds.w).toBeLessThanOrEqual(vw);
    expect(minimapBounds.x + minimapBounds.w).toBeLessThanOrEqual(vw);
    expect(questBounds.x + questBounds.w).toBeLessThanOrEqual(vw);
  });

  it('should verify DialogueModal covers bottom screen and justifies hiding ChatBox and ActionBar', () => {
    const vw = 800;
    const vh = 480;

    const dialogueBounds = calculateDialogueModalBounds(vw, vh);
    const chatBounds = calculateChatBoxBounds(vw, vh);
    const actionBounds = calculateActionBarBounds(vw, vh);

    // If both dialogue and chat/action were rendered, they would collide
    expect(checkRectOverlap(dialogueBounds, chatBounds)).toBe(true);
    expect(checkRectOverlap(dialogueBounds, actionBounds)).toBe(true);
  });

  it('should calculate centered modal bounds for Inventory and Shop modals', () => {
    const vw = 800;
    const vh = 480;

    const invBounds = calculateInventoryModalBounds(vw, vh);
    const shopBounds = calculateShopModalBounds(vw, vh);

    // Centered symmetrically horizontally and vertically
    expect(invBounds.x).toBe(Math.round((vw - invBounds.w) / 2));
    expect(invBounds.y).toBe(Math.round((vh - invBounds.h) / 2));
    expect(shopBounds.x).toBe(Math.round((vw - shopBounds.w) / 2));
    expect(shopBounds.y).toBe(Math.round((vh - shopBounds.h) / 2));

    // Stays strictly within viewport
    expect(invBounds.x).toBeGreaterThan(0);
    expect(invBounds.x + invBounds.w).toBeLessThan(vw);
    expect(shopBounds.x).toBeGreaterThan(0);
    expect(shopBounds.x + shopBounds.w).toBeLessThan(vw);
  });

  it('should calculate Stage HUD card and Stage victory banner bounds cleanly without offside', () => {
    const vw = 800;
    const vh = 480;

    const stageBounds = calculateStageHUDCardBounds();
    const bannerBounds = calculateStageBannerBounds(vw);
    const minimapBounds = calculateMinimapBounds(vw);

    // Stage HUD card is positioned neatly in top-left beneath player HUD panel
    expect(stageBounds.x).toBe(14);
    expect(stageBounds.y).toBe(94);
    expect(stageBounds.w).toBe(210);
    expect(stageBounds.h).toBe(24);

    // Stage victory banner is centered horizontally
    expect(bannerBounds.x).toBe(Math.round((vw - bannerBounds.w) / 2));
    expect(bannerBounds.y).toBe(24);
    expect(bannerBounds.w).toBe(480);
    expect(bannerBounds.h).toBe(54);

    // Banner and Stage card do not collide on 800px viewport
    expect(checkRectOverlap(stageBounds, bannerBounds)).toBe(false);

    // Banner and Minimap do not collide on 800px viewport
    expect(checkRectOverlap(bannerBounds, minimapBounds)).toBe(false);

    // Elements are strictly within screen boundaries
    expect(stageBounds.x).toBeGreaterThanOrEqual(0);
    expect(stageBounds.y + stageBounds.h).toBeLessThanOrEqual(vh);
    expect(bannerBounds.x).toBeGreaterThanOrEqual(0);
    expect(bannerBounds.x + bannerBounds.w).toBeLessThanOrEqual(vw);
  });
});


