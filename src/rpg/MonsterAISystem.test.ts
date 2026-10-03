import { describe, it, expect } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import { VelocityComponent } from '../physics/VelocityComponent';
import {
  StatsComponent,
  CombatComponent,
  NameplateComponent,
  MonsterAIComponent,
} from './RPGComponents';
import { CombatSystem } from './CombatSystem';
import { MonsterAISystem } from './MonsterAISystem';

describe('MonsterAISystem', () => {
  it('harus beralih ke state chase saat pemain masuk ke dalam radius aggro', () => {
    const world = new World();
    const combatSystem = new CombatSystem();
    const monsterAI = new MonsterAISystem(combatSystem);
    world.addSystem(monsterAI);

    // Monster di (100, 100), aggroRadius = 100
    const monster = world.createEntity();
    world.addComponent(monster, new TransformComponent(100, 100));
    world.addComponent(monster, new VelocityComponent(0, 0));
    world.addComponent(monster, new StatsComponent());
    world.addComponent(monster, new CombatComponent());
    world.addComponent(monster, new MonsterAIComponent(100, 100, 100, 250));

    // Pemain di (150, 100) -> Jarak 50px (di dalam aggroRadius 100px)
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(150, 100));
    world.addComponent(player, new StatsComponent());
    world.addComponent(player, new NameplateComponent('Hero', 'player'));

    monsterAI.update(world, 0.1);

    const ai = world.getComponent(monster, MonsterAIComponent)!;
    const vel = world.getComponent(monster, VelocityComponent)!;

    expect(ai.state).toBe('chase');
    expect(ai.targetEntity).toBe(player);
    expect(vel.vx).toBeGreaterThan(0); // Bergerak ke kanan mengejar pemain
  });

  it('harus membatalkan pengejaran dan kembali ke sarang (Return) saat target melarikan diri melebihi leashRadius', () => {
    const world = new World();
    const combatSystem = new CombatSystem();
    const monsterAI = new MonsterAISystem(combatSystem);
    world.addSystem(monsterAI);

    // Monster di posisi (400, 100) dengan sarang homeX = 100, leashRadius = 200 (jarak sarang sudah 300px > 200px)
    const monster = world.createEntity();
    world.addComponent(monster, new TransformComponent(400, 100));
    world.addComponent(monster, new VelocityComponent(0, 0));
    world.addComponent(monster, new StatsComponent({ hp: 50, maxHp: 100 }));
    world.addComponent(monster, new CombatComponent());
    const aiComp = new MonsterAIComponent(100, 100, 100, 200);
    aiComp.state = 'chase';
    world.addComponent(monster, aiComp);

    // Pemain berada jauh
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(500, 100));
    world.addComponent(player, new StatsComponent());
    world.addComponent(player, new NameplateComponent('Hero', 'player'));
    aiComp.targetEntity = player;

    monsterAI.update(world, 0.1);

    expect(aiComp.state).toBe('return');
    expect(aiComp.targetEntity).toBeNull();

    const vel = world.getComponent(monster, VelocityComponent)!;
    expect(vel.vx).toBeLessThan(0); // Berlari balik ke kiri menuju homeX (100)
  });

  it('harus menghentikan pergerakan saat monster mati dan menyiapkan respawn', () => {
    const world = new World();
    const combatSystem = new CombatSystem();
    const monsterAI = new MonsterAISystem(combatSystem);

    const monster = world.createEntity();
    world.addComponent(monster, new TransformComponent(100, 100));
    world.addComponent(monster, new VelocityComponent(50, 50));
    world.addComponent(monster, new StatsComponent({ hp: 0 })); // HP 0 = Mati
    world.addComponent(monster, new CombatComponent());
    world.addComponent(monster, new MonsterAIComponent(100, 100));

    monsterAI.update(world, 0.1);

    const vel = world.getComponent(monster, VelocityComponent)!;
    expect(vel.vx).toBe(0);
    expect(vel.vy).toBe(0);
  });
});
