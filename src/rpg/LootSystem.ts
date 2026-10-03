import type { Entity } from '../ecs/Entity';
import type { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import { StatsComponent } from './RPGComponents';
import { InventoryComponent } from './InventorySystem';
import type { CombatSystem } from './CombatSystem';
import type { ChatManager } from './ChatSystem';
import type { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { MMOVisualComponent } from './MMORenderSystem';

export type LootType = 'gold' | 'potion_hp' | 'potion_mp' | 'equipment';

export interface LootStatBonus {
  attack?: number;
  defense?: number;
  maxHp?: number;
}

export interface LootDropOptions {
  itemName: string;
  itemType: LootType;
  value?: number;
  statBonus?: LootStatBonus;
  pickupRadius?: number;
  lifetime?: number;
}

/**
 * LootDropComponent menandai entitas barang jarahan yang tercecer di tanah.
 */
export class LootDropComponent {
  public itemName: string;
  public itemType: LootType;
  public value: number;
  public statBonus?: LootStatBonus;
  public pickupRadius: number;
  public lifetime: number;
  public elapsed: number = 0;

  constructor(options: LootDropOptions) {
    this.itemName = options.itemName;
    this.itemType = options.itemType;
    this.value = options.value ?? 1;
    this.statBonus = options.statBonus;
    this.pickupRadius = options.pickupRadius ?? 36;
    this.lifetime = options.lifetime ?? 35.0;
  }
}

/**
 * LootSystem mengelola barang drop di tanah:
 * Mengurangi timer masa aktif dan memproses auto-pickup saat pemain mendekat.
 */
export class LootSystem {
  public update(
    world: World,
    player: Entity,
    dt: number,
    combatSystem: CombatSystem,
    chatManager: ChatManager,
    audio?: SoundSynthesizer
  ): void {
    const playerTrans = world.getComponent(player, TransformComponent);
    const playerStats = world.getComponent(player, StatsComponent);
    if (!playerTrans || !playerStats || playerStats.hp <= 0) return;

    const lootEntities = world.query(TransformComponent, LootDropComponent);

    for (const lootEnt of lootEntities) {
      const loot = world.getComponent(lootEnt, LootDropComponent);
      const trans = world.getComponent(lootEnt, TransformComponent);
      if (!loot || !trans) continue;

      loot.elapsed += dt;

      // Hapus barang jarahan jika kadaluarsa di tanah
      if (loot.elapsed >= loot.lifetime) {
        world.queueDestroy(lootEnt);
        continue;
      }

      // Deteksi jarak ke pemain
      const dx = (trans.x + 10) - (playerTrans.x + 16);
      const dy = (trans.y + 10) - (playerTrans.y + 16);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= loot.pickupRadius) {
        // Ambil barang
        let pickupText = `+${loot.itemName}`;

        switch (loot.itemType) {
          case 'gold':
            playerStats.gold += loot.value;
            pickupText = `+${loot.value} Gold`;
            break;
          case 'potion_hp':
            playerStats.hpPotions += loot.value;
            pickupText = `+${loot.value} HP Potion`;
            break;
          case 'potion_mp':
            playerStats.mpPotions += loot.value;
            pickupText = `+${loot.value} MP Potion`;
            break;
          case 'equipment':
            if (loot.statBonus) {
              if (loot.statBonus.attack) playerStats.attack += loot.statBonus.attack;
              if (loot.statBonus.defense) playerStats.defense += loot.statBonus.defense;
              if (loot.statBonus.maxHp) {
                playerStats.maxHp += loot.statBonus.maxHp;
                playerStats.hp += loot.statBonus.maxHp;
              }
            }
            break;
        }

        // Sinkronisasi dengan InventoryComponent pemain jika ada
        const inv = world.getComponent(player, InventoryComponent);
        if (inv) {
          if (loot.itemType === 'equipment') {
            inv.addItem({
              id: loot.itemName.toLowerCase().replace(/\s+/g, '_'),
              name: loot.itemName,
              type: 'accessory',
              rarity: 'epic',
              description: 'A legendary trophy of heroic triumph.',
              quantity: 1,
              statBonus: loot.statBonus,
            });
          } else if (loot.itemType === 'potion_hp') {
            inv.addItem({
              id: 'potion_hp',
              name: 'Health Potion',
              type: 'consumable',
              rarity: 'common',
              description: 'Restores 50 HP.',
              quantity: loot.value,
              healHp: 50,
            });
          } else if (loot.itemType === 'potion_mp') {
            inv.addItem({
              id: 'potion_mp',
              name: 'Mana Potion',
              type: 'consumable',
              rarity: 'common',
              description: 'Restores 35 MP.',
              quantity: loot.value,
              healMp: 35,
            });
          }
        }

        // Floating text & notifikasi chat
        combatSystem.spawnFloatingText(
          world,
          playerTrans.x + 4,
          playerTrans.y - 18,
          pickupText,
          '#f0c674',
          false
        );

        chatManager.addMessage('System', `Obtained: ${pickupText}!`, 'system');

        if (audio) {
          audio.playLootPickup();
        }

        world.queueDestroy(lootEnt);
      }
    }
  }

  /**
   * Helper untuk memunculkan drop item di posisi tertentu di dunia game.
   */
  public spawnLoot(
    world: World,
    x: number,
    y: number,
    options: LootDropOptions
  ): Entity {
    const entity = world.createEntity();
    world.addComponent(entity, new TransformComponent(x, y));
    world.addComponent(entity, new LootDropComponent(options));
    world.addComponent(
      entity,
      new MMOVisualComponent({
        width: 20,
        height: 20,
        visualType: 'campfire', // campfire/chest icon representation for ground items
        label: options.itemName,
      })
    );
    return entity;
  }
}
