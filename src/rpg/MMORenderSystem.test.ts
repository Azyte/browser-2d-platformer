import { describe, it, expect } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import {
  sortEntitiesByDepth,
  calculateHealthBarWidth,
  formatChatTimestamp,
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
});
