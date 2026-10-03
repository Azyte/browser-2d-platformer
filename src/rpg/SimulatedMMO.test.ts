import { describe, it, expect } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import { VelocityComponent } from '../physics/VelocityComponent';
import {
  StatsComponent,
  CombatComponent,
  NameplateComponent,
  MonsterAIComponent,
  SimulatedPlayerComponent,
} from './RPGComponents';
import { CombatSystem } from './CombatSystem';
import { ChatManager } from './ChatSystem';
import { SimulatedMMOPlayerSystem } from './SimulatedMMOPlayerSystem';

describe('SimulatedMMOPlayerSystem & ChatManager', () => {
  it('harus membatasi kapasitas pesan di ChatManager (FIFO ring buffer)', () => {
    const chat = new ChatManager(3);
    chat.addMessage('System', 'Msg 1', 'system');
    chat.addMessage('System', 'Msg 2', 'system');
    chat.addMessage('System', 'Msg 3', 'system');
    chat.addMessage('System', 'Msg 4', 'system');

    const msgs = chat.getMessages();
    expect(msgs.length).toBe(3);
    expect(msgs[0].text).toBe('Msg 2');
    expect(msgs[2].text).toBe('Msg 4');
  });

  it('harus mencari monster hidup terdekat dan bergerak mendekatinya untuk bertarung', () => {
    const world = new World();
    const combat = new CombatSystem();
    const chat = new ChatManager();
    const botSystem = new SimulatedMMOPlayerSystem(combat, chat);

    // Bot di (100, 100)
    const bot = world.createEntity();
    world.addComponent(bot, new TransformComponent(100, 100));
    world.addComponent(bot, new VelocityComponent(0, 0));
    world.addComponent(bot, new StatsComponent());
    world.addComponent(bot, new CombatComponent({ attackRange: 40 }));
    world.addComponent(bot, new NameplateComponent('Knight_Bot', 'other_player'));
    world.addComponent(bot, new SimulatedPlayerComponent());

    // Monster di (250, 100) -> berjarak 150px (di luar attackRange 40px)
    const monster = world.createEntity();
    world.addComponent(monster, new TransformComponent(250, 100));
    world.addComponent(monster, new StatsComponent({ hp: 100 }));
    world.addComponent(monster, new MonsterAIComponent(250, 100));

    botSystem.update(world, 0.1);

    const botComp = world.getComponent(bot, SimulatedPlayerComponent)!;
    const botVel = world.getComponent(bot, VelocityComponent)!;

    expect(botComp.targetMonster).toBe(monster);
    expect(botVel.vx).toBeGreaterThan(0); // Bergerak ke kanan mendekati monster
  });

  it('harus meminum HP potion saat HP berada di bawah 35%', () => {
    const world = new World();
    const combat = new CombatSystem();
    const chat = new ChatManager();
    const botSystem = new SimulatedMMOPlayerSystem(combat, chat);

    const bot = world.createEntity();
    world.addComponent(bot, new TransformComponent(0, 0));
    world.addComponent(bot, new VelocityComponent(0, 0));
    // HP kritis: 20 dari 100 (20% < 35%)
    world.addComponent(bot, new StatsComponent({ hp: 20, maxHp: 100, hpPotions: 2 }));
    world.addComponent(bot, new CombatComponent());
    world.addComponent(bot, new NameplateComponent('Healer_Bot', 'other_player'));
    world.addComponent(bot, new SimulatedPlayerComponent());

    botSystem.update(world, 0.1);

    const stats = world.getComponent(bot, StatsComponent)!;
    expect(stats.hp).toBe(70); // 20 + 50 = 70
    expect(stats.hpPotions).toBe(1);
  });
});
