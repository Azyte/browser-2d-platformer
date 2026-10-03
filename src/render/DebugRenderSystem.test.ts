import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import { ColliderComponent, SolidObstacleComponent } from '../physics/PhysicsComponents';
import { MonsterAIComponent } from '../rpg/RPGComponents';
import { DebugRenderSystem } from './DebugRenderSystem';

describe('DebugRenderSystem - Engine Bounding Box & AI Visualizer', () => {
  let debugSystem: DebugRenderSystem;
  let world: World;

  beforeEach(() => {
    debugSystem = new DebugRenderSystem();
    world = new World();
  });

  it('should initialize disabled by default and toggle correctly', () => {
    expect(debugSystem.isEnabled).toBe(false);

    debugSystem.toggle();
    expect(debugSystem.isEnabled).toBe(true);

    debugSystem.toggle();
    expect(debugSystem.isEnabled).toBe(false);
  });

  it('should collect collider bounds for obstacles and entities', () => {
    // Solid obstacle
    const tree = world.createEntity();
    world.addComponent(tree, new TransformComponent(100, 100));
    world.addComponent(tree, new ColliderComponent(30, 20, 5, 10, true));
    world.addComponent(tree, new SolidObstacleComponent());

    // Moving entity
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(200, 200));
    world.addComponent(player, new ColliderComponent(24, 24, 0, 0, false));

    const debugData = debugSystem.inspectColliders(world);

    expect(debugData.solidColliders.length).toBe(1);
    expect(debugData.solidColliders[0].bounds.width).toBe(30);
    expect(debugData.solidColliders[0].bounds.height).toBe(20);

    expect(debugData.movingColliders.length).toBe(1);
    expect(debugData.movingColliders[0].bounds.width).toBe(24);
  });

  it('should inspect monster AI aggro and leash parameters', () => {
    const mob = world.createEntity();
    world.addComponent(mob, new TransformComponent(500, 400));
    world.addComponent(mob, new MonsterAIComponent(500, 400, 150, 300));

    const aiList = debugSystem.inspectMonsterAI(world);
    expect(aiList.length).toBe(1);
    expect(aiList[0].aggroRadius).toBe(150);
    expect(aiList[0].leashRadius).toBe(300);
    expect(aiList[0].homeX).toBe(500);
    expect(aiList[0].homeY).toBe(400);
  });
});
