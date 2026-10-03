import type { StatsComponent } from './RPGComponents';

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'material';
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemStatBonus {
  attack?: number;
  defense?: number;
  maxHp?: number;
  maxMp?: number;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  description: string;
  icon?: string;
  quantity: number;
  maxStack?: number;
  statBonus?: ItemStatBonus;
  healHp?: number;
  healMp?: number;
}

export type EquipSlot = 'weapon' | 'armor' | 'accessory';

/**
 * InventoryComponent mengelola penyimpanan tas pemain dan slot perlengkapan aktif.
 */
export class InventoryComponent {
  public maxSlots: number;
  public slots: (Item | null)[];
  public equipment: Record<EquipSlot, Item | null>;
  public isOpen: boolean = false;
  public selectedSlotIndex: number | null = null;
  public selectedEquipSlot: EquipSlot | null = null;

  constructor(maxSlots: number = 16) {
    this.maxSlots = maxSlots;
    this.slots = new Array(maxSlots).fill(null);
    this.equipment = {
      weapon: null,
      armor: null,
      accessory: null,
    };
  }

  /**
   * Menambahkan item ke dalam tas (menumpuk jika stackable atau mengisi slot kosong).
   */
  public addItem(item: Item): boolean {
    const maxStack = item.maxStack ?? (item.type === 'consumable' || item.type === 'material' ? 99 : 1);

    // 1. Coba tumpuk ke item yang sama jika stackable
    if (maxStack > 1) {
      for (let i = 0; i < this.maxSlots; i++) {
        const slotItem = this.slots[i];
        if (slotItem && slotItem.id === item.id && slotItem.quantity < maxStack) {
          const space = maxStack - slotItem.quantity;
          const toAdd = Math.min(space, item.quantity);
          slotItem.quantity += toAdd;
          item.quantity -= toAdd;

          if (item.quantity <= 0) return true;
        }
      }
    }

    // 2. Isi slot kosong pertama
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] === null) {
        this.slots[i] = { ...item };
        return true;
      }
    }

    // Tas penuh
    return false;
  }

  /**
   * Menghapus sejumlah kuantitas item dari slot tertentu.
   */
  public removeItem(index: number, quantity: number = 1): Item | null {
    if (index < 0 || index >= this.maxSlots) return null;
    const current = this.slots[index];
    if (!current) return null;

    if (current.quantity <= quantity) {
      this.slots[index] = null;
      return current;
    } else {
      current.quantity -= quantity;
      return { ...current, quantity };
    }
  }

  /**
   * Memasang perlengkapan dari slot tas ke slot equipment yang sesuai.
   * Menerapkan bonus atribut ke StatsComponent.
   */
  public equipItem(index: number, stats?: StatsComponent): boolean {
    if (index < 0 || index >= this.maxSlots) return false;
    const item = this.slots[index];
    if (!item) return false;

    if (item.type !== 'weapon' && item.type !== 'armor' && item.type !== 'accessory') {
      return false;
    }

    const slotKey = item.type as EquipSlot;
    const oldEquipped = this.equipment[slotKey];

    // Lepas atribut perlengkapan lama jika ada
    if (oldEquipped && stats && oldEquipped.statBonus) {
      this.applyStatDelta(stats, oldEquipped.statBonus, -1);
    }

    // Pasang item baru
    this.equipment[slotKey] = item;
    this.slots[index] = oldEquipped; // Tukar tempat (swap)

    // Tambahkan atribut perlengkapan baru
    if (stats && item.statBonus) {
      this.applyStatDelta(stats, item.statBonus, 1);
    }

    return true;
  }

  /**
   * Melepas perlengkapan dan mengembalikannya ke slot tas yang kosong.
   */
  public unequipItem(slot: EquipSlot, stats?: StatsComponent): boolean {
    const item = this.equipment[slot];
    if (!item) return false;

    // Cari slot tas kosong
    let emptyIndex = -1;
    for (let i = 0; i < this.maxSlots; i++) {
      if (this.slots[i] === null) {
        emptyIndex = i;
        break;
      }
    }

    if (emptyIndex === -1) {
      // Tas penuh, tidak bisa dilepas
      return false;
    }

    // Lepas atribut dari stats
    if (stats && item.statBonus) {
      this.applyStatDelta(stats, item.statBonus, -1);
    }

    this.slots[emptyIndex] = item;
    this.equipment[slot] = null;
    return true;
  }

  /**
   * Menggunakan item pakai-habis (ramuan/potion) dari tas.
   */
  public useItem(index: number, stats?: StatsComponent): boolean {
    if (index < 0 || index >= this.maxSlots) return false;
    const item = this.slots[index];
    if (!item || item.type !== 'consumable') return false;

    if (stats) {
      if (item.healHp) {
        stats.hp = Math.min(stats.maxHp, stats.hp + item.healHp);
      }
      if (item.healMp) {
        stats.mp = Math.min(stats.maxMp, stats.mp + item.healMp);
      }
    }

    item.quantity -= 1;
    if (item.quantity <= 0) {
      this.slots[index] = null;
    }

    return true;
  }

  /**
   * Menerapkan selisih stat ke StatsComponent.
   */
  private applyStatDelta(stats: StatsComponent, bonus: ItemStatBonus, sign: number): void {
    if (bonus.attack) stats.attack += bonus.attack * sign;
    if (bonus.defense) stats.defense += bonus.defense * sign;
    if (bonus.maxHp) {
      stats.maxHp += bonus.maxHp * sign;
      stats.hp = Math.min(stats.maxHp, Math.max(1, stats.hp + bonus.maxHp * sign));
    }
    if (bonus.maxMp) {
      stats.maxMp += bonus.maxMp * sign;
      stats.mp = Math.min(stats.maxMp, Math.max(0, stats.mp + bonus.maxMp * sign));
    }
  }
}

/**
 * Membuat paket perlengkapan dan isi tas awal untuk pemain baru.
 */
export function createStarterInventory(): InventoryComponent {
  const inv = new InventoryComponent(16);

  // Perlengkapan Terpasang
  inv.equipment.weapon = {
    id: 'iron_longsword',
    name: 'Iron Longsword',
    type: 'weapon',
    rarity: 'common',
    description: 'A sturdy iron blade standard for kingdom guards.',
    quantity: 1,
    statBonus: { attack: 8 },
  };

  inv.equipment.armor = {
    id: 'squire_tunic',
    name: 'Squire Tunic',
    type: 'armor',
    rarity: 'common',
    description: 'Reinforced leather armor padded with chainmail.',
    quantity: 1,
    statBonus: { defense: 6, maxHp: 20 },
  };

  // Isi Tas
  inv.slots[0] = {
    id: 'potion_hp',
    name: 'Health Potion',
    type: 'consumable',
    rarity: 'common',
    description: 'Brewed herbs that restore 50 Health Points.',
    quantity: 3,
    maxStack: 99,
    healHp: 50,
  };

  inv.slots[1] = {
    id: 'potion_mp',
    name: 'Mana Potion',
    type: 'consumable',
    rarity: 'common',
    description: 'Concentrated ether that restores 35 Mana Points.',
    quantity: 2,
    maxStack: 99,
    healMp: 35,
  };

  inv.slots[2] = {
    id: 'slime_gel',
    name: 'Slime Essence',
    type: 'material',
    rarity: 'common',
    description: 'Gelatinous core from defeated Forest Slimes.',
    quantity: 5,
    maxStack: 99,
  };

  return inv;
}

/**
 * InventorySystem mengelola input buka/tutup antarmuka inventaris tas pemain.
 */
export class InventorySystem {
  /**
   * Mengubah status terbuka atau tertutupnya jendela inventaris.
   */
  public toggle(inventory: InventoryComponent): boolean {
    inventory.isOpen = !inventory.isOpen;
    if (!inventory.isOpen) {
      inventory.selectedSlotIndex = null;
      inventory.selectedEquipSlot = null;
    }
    return inventory.isOpen;
  }
}
