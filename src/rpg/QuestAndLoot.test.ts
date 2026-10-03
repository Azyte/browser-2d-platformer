import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import { StatsComponent } from './RPGComponents';
import { QuestManager } from './QuestSystem';
import { LootSystem, LootDropComponent } from './LootSystem';
import { CombatSystem } from './CombatSystem';
import { ChatManager } from './ChatSystem';

describe('QuestSystem & LootSystem', () => {
  let world: World;
  let combatSystem: CombatSystem;
  let chatManager: ChatManager;
  let questManager: QuestManager;
  let lootSystem: LootSystem;

  beforeEach(() => {
    world = new World();
    combatSystem = new CombatSystem();
    chatManager = new ChatManager();
    questManager = new QuestManager();
    lootSystem = new LootSystem();
  });

  it('should track monster kills and complete quest when target count reached', () => {
    questManager.addQuest({
      id: 'q1',
      title: 'Slime Hunter',
      description: 'Hunt 2 Forest Slimes',
      targetName: 'Forest Slime',
      requiredCount: 2,
      currentCount: 0,
      expReward: 80,
      goldReward: 50,
      isCompleted: false,
      isClaimed: false,
    });

    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(100, 100));
    world.addComponent(player, new StatsComponent({ level: 1, exp: 0, gold: 0 }));

    // Kill 1st slime
    const qAfter1 = questManager.onMonsterKilled('Forest Slime', world, player, combatSystem, chatManager);
    expect(qAfter1).toBeNull();
    expect(questManager.getQuest('q1')?.currentCount).toBe(1);
    expect(questManager.getQuest('q1')?.isCompleted).toBe(false);

    // Kill 2nd slime
    const qAfter2 = questManager.onMonsterKilled('Forest Slime', world, player, combatSystem, chatManager);
    expect(qAfter2).not.toBeNull();
    expect(questManager.getQuest('q1')?.currentCount).toBe(2);
    expect(questManager.getQuest('q1')?.isCompleted).toBe(true);

    const stats = world.getComponent(player, StatsComponent)!;
    expect(stats.level).toBe(2); // 80 exp leveled up from 1 to 2
    expect(stats.exp).toBe(0); // exp rolled over after level up
    expect(stats.gold).toBe(50);
  });

  it('should auto-pickup ground loot when player walks within pickup radius', () => {
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(100, 100));
    world.addComponent(player, new StatsComponent({ gold: 10, hpPotions: 1 }));

    // Drop loot 20px away from player (within radius 36)
    const loot = world.createEntity();
    world.addComponent(loot, new TransformComponent(115, 105));
    world.addComponent(
      loot,
      new LootDropComponent({
        itemName: 'Gold Pouch',
        itemType: 'gold',
        value: 45,
      })
    );

    lootSystem.update(world, player, 0.016, combatSystem, chatManager);

    const stats = world.getComponent(player, StatsComponent)!;
    expect(stats.gold).toBe(55); // 10 + 45
  });

  it('should not pickup ground loot if player is outside pickup radius', () => {
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(100, 100));
    world.addComponent(player, new StatsComponent({ gold: 10 }));

    // Drop loot 150px away
    const loot = world.createEntity();
    world.addComponent(loot, new TransformComponent(250, 100));
    world.addComponent(
      loot,
      new LootDropComponent({
        itemName: 'Gold Pouch',
        itemType: 'gold',
        value: 50,
        pickupRadius: 36,
      })
    );

    lootSystem.update(world, player, 0.016, combatSystem, chatManager);

    const stats = world.getComponent(player, StatsComponent)!;
    expect(stats.gold).toBe(10); // unchanged
  });
});
