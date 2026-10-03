import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import { StatsComponent } from './RPGComponents';
import { CombatSystem } from './CombatSystem';
import { ChatManager } from './ChatSystem';
import {
  NPCComponent,
  NPCSystem,
  createElderRowanDialogue,
} from './NPCSystem';

describe('NPCSystem & Dialogue', () => {
  let world: World;
  let npcSystem: NPCSystem;
  let chatManager: ChatManager;
  let combatSystem: CombatSystem;

  beforeEach(() => {
    world = new World();
    npcSystem = new NPCSystem();
    chatManager = new ChatManager();
    combatSystem = new CombatSystem();
  });

  it('harus mendeteksi NPC terdekat ketika pemain dalam interaction radius', () => {
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(100, 100));
    world.addComponent(player, new StatsComponent());

    const npc = world.createEntity();
    world.addComponent(npc, new TransformComponent(120, 100)); // jarak 20px
    world.addComponent(
      npc,
      new NPCComponent({
        npcId: 'elder_rowan',
        name: 'Elder Rowan',
        dialogueTree: createElderRowanDialogue(),
        interactionRadius: 60,
      })
    );

    const nearby = npcSystem.checkNearbyNPC(world, player);
    expect(nearby).toBe(npc);
  });

  it('tidak mendeteksi NPC jika pemain berada di luar interaction radius', () => {
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(100, 100));
    world.addComponent(player, new StatsComponent());

    const npc = world.createEntity();
    world.addComponent(npc, new TransformComponent(300, 300)); // jarak > 200px
    world.addComponent(
      npc,
      new NPCComponent({
        npcId: 'elder_rowan',
        name: 'Elder Rowan',
        dialogueTree: createElderRowanDialogue(),
        interactionRadius: 60,
      })
    );

    const nearby = npcSystem.checkNearbyNPC(world, player);
    expect(nearby).toBeNull();
  });

  it('harus membuka dialog dan memilih opsi percabangan', () => {
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(100, 100));
    const pStats = new StatsComponent({ hp: 50, maxHp: 150 });
    world.addComponent(player, pStats);

    const npc = world.createEntity();
    const npcComp = new NPCComponent({
      npcId: 'elder_rowan',
      name: 'Elder Rowan',
      dialogueTree: createElderRowanDialogue(),
    });
    world.addComponent(npc, new TransformComponent(110, 100));
    world.addComponent(npc, npcComp);

    // Buka dialog
    npcSystem.startDialogue(npc, world);
    expect(npcSystem.isDialogueOpen).toBe(true);
    expect(npcSystem.activeNPC).toBe(npc);

    const currentNode = npcSystem.getCurrentNode();
    expect(currentNode).toBeDefined();
    expect(currentNode?.options.length).toBeGreaterThan(0);

    // Pilih opsi 0 (Lore) -> berpindah ke node lore
    npcSystem.chooseOption(0, world, player, chatManager, combatSystem);
    expect(npcSystem.isDialogueOpen).toBe(true);
    expect(npcSystem.getCurrentNode()?.id).toBe('lore');

    // Kembali ke start
    npcSystem.chooseOption(0, world, player, chatManager, combatSystem);
    expect(npcSystem.getCurrentNode()?.id).toBe('root');

    // Pilih opsi Blessing (sembuhkan HP)
    npcSystem.chooseOption(1, world, player, chatManager, combatSystem);
    expect(pStats.hp).toBe(pStats.maxHp); // Pemain sembuh penuh
  });

  it('harus menutup dialog saat memilih opsi pamit (farewell)', () => {
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(100, 100));
    world.addComponent(player, new StatsComponent());

    const npc = world.createEntity();
    world.addComponent(npc, new TransformComponent(110, 100));
    world.addComponent(
      npc,
      new NPCComponent({
        npcId: 'elder_rowan',
        name: 'Elder Rowan',
        dialogueTree: createElderRowanDialogue(),
      })
    );

    npcSystem.startDialogue(npc, world);
    expect(npcSystem.isDialogueOpen).toBe(true);

    // Opsi ke-2 di root adalah Farewell
    npcSystem.chooseOption(2, world, player, chatManager, combatSystem);
    expect(npcSystem.isDialogueOpen).toBe(false);
    expect(npcSystem.activeNPC).toBeNull();
  });

  it('mendukung dialog Pedagang Elric dan aksi open_shop', () => {
    const player = world.createEntity();
    world.addComponent(player, new TransformComponent(100, 100));
    world.addComponent(player, new StatsComponent());

    const merchant = world.createEntity();
    world.addComponent(merchant, new TransformComponent(110, 100));
    world.addComponent(
      merchant,
      new NPCComponent({
        npcId: 'merchant_elric',
        name: 'Merchant Elric',
        dialogueTree: createElderRowanDialogue(), // tested with tree
        markerType: 'shop',
      })
    );

    npcSystem.startDialogue(merchant, world);
    expect(npcSystem.isDialogueOpen).toBe(true);
  });
});

