import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/World';
import { StatsComponent } from './RPGComponents';
import {
  InventoryComponent,
  InventorySystem,
  createStarterInventory,
} from './InventorySystem';
import type { Item } from './InventorySystem';

describe('InventorySystem & Equipment', () => {
  let world: World;
  let invSystem: InventorySystem;

  beforeEach(() => {
    world = new World();
    invSystem = new InventorySystem();
  });

  it('harus membuat starter inventory dengan senjata dan zirah awal', () => {
    const inv = createStarterInventory();
    expect(inv.equipment.weapon).toBeDefined();
    expect(inv.equipment.weapon?.name).toBe('Iron Longsword');
    expect(inv.equipment.armor?.name).toBe('Squire Tunic');

    // Cek ada item di dalam tas
    const bagItems = inv.slots.filter((item): item is Item => item !== null);
    expect(bagItems.length).toBeGreaterThan(0);
  });

  it('harus dapat menambahkan item ke dalam tas (inventory bag)', () => {
    const inv = new InventoryComponent(8);
    const item: Item = {
      id: 'fenrir_crest',
      name: 'Fenrir Crest',
      type: 'accessory',
      rarity: 'epic',
      description: 'Crest of the fallen Alpha Wolf Fenrir.',
      quantity: 1,
      statBonus: { attack: 15, defense: 8, maxHp: 50 },
    };

    const added = inv.addItem(item);
    expect(added).toBe(true);
    expect(inv.slots[0]?.id).toBe('fenrir_crest');
  });

  it('harus menumpuk (stack) item yang sama jika stackable', () => {
    const inv = new InventoryComponent(8);
    inv.addItem({
      id: 'potion_hp',
      name: 'Health Potion',
      type: 'consumable',
      rarity: 'common',
      description: 'Restores 50 HP.',
      quantity: 2,
      maxStack: 10,
      healHp: 50,
    });

    inv.addItem({
      id: 'potion_hp',
      name: 'Health Potion',
      type: 'consumable',
      rarity: 'common',
      description: 'Restores 50 HP.',
      quantity: 3,
      maxStack: 10,
      healHp: 50,
    });

    expect(inv.slots[0]?.quantity).toBe(5);
  });

  it('harus dapat memasang (equip) item dan meningkatkan stat pemain', () => {
    const player = world.createEntity();
    const stats = new StatsComponent({ attack: 20, defense: 10, maxHp: 100, hp: 100 });
    const inv = new InventoryComponent(8);
    world.addComponent(player, stats);
    world.addComponent(player, inv);

    const sword: Item = {
      id: 'blade_slayer',
      name: 'Rune Blade',
      type: 'weapon',
      rarity: 'rare',
      description: 'Infused with mystical energy.',
      quantity: 1,
      statBonus: { attack: 12 },
    };

    inv.addItem(sword);
    expect(inv.slots[0]?.id).toBe('blade_slayer');

    // Pasang Rune Blade dari slot 0
    const equipped = inv.equipItem(0, stats);
    expect(equipped).toBe(true);
    expect(inv.equipment.weapon?.id).toBe('blade_slayer');
    expect(inv.slots[0]).toBeNull(); // Slot tas kosong setelah dipasang
    expect(stats.attack).toBe(32); // 20 + 12

    // Lepas (unequip) Rune Blade
    const unequipped = inv.unequipItem('weapon', stats);
    expect(unequipped).toBe(true);
    expect(inv.equipment.weapon).toBeNull();
    expect(stats.attack).toBe(20); // Kembali ke baseline
    expect(inv.slots[0]?.id).toBe('blade_slayer'); // Kembali ke tas
  });

  it('harus dapat mengonsumsi item pemulih HP (useItem)', () => {
    const stats = new StatsComponent({ hp: 40, maxHp: 100 });
    const inv = new InventoryComponent(8);

    inv.addItem({
      id: 'potion_hp',
      name: 'Health Potion',
      type: 'consumable',
      rarity: 'common',
      description: 'Restores 50 HP.',
      quantity: 2,
      healHp: 50,
    });

    const used = inv.useItem(0, stats);
    expect(used).toBe(true);
    expect(stats.hp).toBe(90);
    expect(inv.slots[0]?.quantity).toBe(1); // Berkurang 1 dari stack

    // Minum lagi
    inv.useItem(0, stats);
    expect(stats.hp).toBe(100); // Clamped ke maxHp
    expect(inv.slots[0]).toBeNull(); // Habis sehingga slot kosong
  });

  it('harus toggle modal inventory via InventorySystem', () => {
    const inv = new InventoryComponent(8);
    expect(inv.isOpen).toBe(false);

    invSystem.toggle(inv);
    expect(inv.isOpen).toBe(true);

    invSystem.toggle(inv);
    expect(inv.isOpen).toBe(false);
  });
});
