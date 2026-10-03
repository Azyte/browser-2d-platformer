import type { World } from '../ecs/World';
import type { Entity } from '../ecs/Entity';
import { StatsComponent } from './RPGComponents';
import {
  InventoryComponent,
  type Item,
  type ItemType,
  type ItemRarity,
  type ItemStatBonus,
} from './InventorySystem';

export interface ShopItem {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  cost: number;
  description: string;
  icon: string;
  maxStack?: number;
  statBonus?: ItemStatBonus;
  healHp?: number;
  healMp?: number;
}

export interface TransactionResult {
  success: boolean;
  message: string;
  costOrEarnings?: number;
  item?: Item;
}

/**
 * Katalog default barang yang dijual oleh Pedagang Elric di Sanctuary.
 */
export function getDefaultShopCatalog(): ShopItem[] {
  return [
    {
      id: 'potion_hp',
      name: 'Health Potion',
      type: 'consumable',
      rarity: 'common',
      cost: 15,
      description: 'Ramuan herbal merah segar yang memulihkan 50 Darah (HP) secara instan.',
      icon: '🧪',
      maxStack: 99,
      healHp: 50,
    },
    {
      id: 'potion_mp',
      name: 'Mana Potion',
      type: 'consumable',
      rarity: 'common',
      cost: 20,
      description: 'Cairan kristal biru bercahaya yang memulihkan 35 Mana (MP) instan.',
      icon: '🔹',
      maxStack: 99,
      healMp: 35,
    },
    {
      id: 'claymore_valiant',
      name: 'Valiant Claymore',
      type: 'weapon',
      rarity: 'rare',
      cost: 75,
      description: 'Pedang dua tangan baja kirmisi bertuah (+16 ATK). Menembus pertahanan monster keras.',
      icon: '🗡️',
      maxStack: 1,
      statBonus: { attack: 16 },
    },
    {
      id: 'plate_guardian',
      name: 'Guardian Plate',
      type: 'armor',
      rarity: 'rare',
      cost: 110,
      description: 'Zirah lempeng baja berkilau (+12 DEF, +50 Max HP). Mengurangi hantaman cakar Fenrir.',
      icon: '🛡️',
      maxStack: 1,
      statBonus: { defense: 12, maxHp: 50 },
    },
    {
      id: 'amulet_phoenix',
      name: 'Phoenix Talisman',
      type: 'accessory',
      rarity: 'epic',
      cost: 140,
      description: 'Jimat bulu burung api legendaris (+40 Max MP, +4 ATK, +3 DEF). Mengalirkan energi sihir murni.',
      icon: '🔥',
      maxStack: 1,
      statBonus: { maxMp: 40, attack: 4, defense: 3 },
    },
  ];
}

/**
 * ShopSystem mengelola katalog barang pedagang, validasi transaksi belanja dan penjualan,
 * serta integrasi dengan dompet gold pemain dan inventaris tas.
 */
export class ShopSystem {
  public isOpen: boolean = false;
  public shopItems: ShopItem[];
  public selectedShopIndex: number = 0;
  public activeTab: 'buy' | 'sell' = 'buy';

  constructor(items?: ShopItem[]) {
    this.shopItems = items ?? getDefaultShopCatalog();
  }

  public open(): void {
    this.isOpen = true;
  }

  public close(): void {
    this.isOpen = false;
  }

  public toggle(): boolean {
    this.isOpen = !this.isOpen;
    return this.isOpen;
  }

  /**
   * Membeli barang dari toko.
   */
  public buyItem(world: World, playerEntity: Entity, shopItemId: string): TransactionResult {
    const stats = world.getComponent(playerEntity, StatsComponent);
    const inventory = world.getComponent(playerEntity, InventoryComponent);

    if (!stats || !inventory) {
      return { success: false, message: 'Entitas tidak memiliki status atau inventaris.' };
    }

    const shopItem = this.shopItems.find((i) => i.id === shopItemId);
    if (!shopItem) {
      return { success: false, message: 'Barang tidak ditemukan di katalog toko.' };
    }

    if (stats.gold < shopItem.cost) {
      return {
        success: false,
        message: `Gold tidak mencukupi! Butuh ${shopItem.cost} G (Miliki: ${stats.gold} G)`,
      };
    }

    const newItem: Item = {
      id: shopItem.id,
      name: shopItem.name,
      type: shopItem.type,
      rarity: shopItem.rarity,
      description: shopItem.description,
      icon: shopItem.icon,
      quantity: 1,
      maxStack: shopItem.maxStack,
      statBonus: shopItem.statBonus ? { ...shopItem.statBonus } : undefined,
      healHp: shopItem.healHp,
      healMp: shopItem.healMp,
    };

    const added = inventory.addItem(newItem);
    if (!added) {
      return { success: false, message: 'Tas inventaris penuh! Kosongkan slot terlebih dahulu.' };
    }

    stats.gold -= shopItem.cost;

    // Sinkronisasi potion counter di bar cepat jika membeli ramuan
    if (shopItem.id === 'potion_hp') {
      stats.hpPotions = (stats.hpPotions ?? 0) + 1;
    } else if (shopItem.id === 'potion_mp') {
      stats.mpPotions = (stats.mpPotions ?? 0) + 1;
    }

    return {
      success: true,
      message: `Berhasil membeli ${shopItem.name} seharga ${shopItem.cost} G!`,
      costOrEarnings: shopItem.cost,
      item: newItem,
    };
  }

  /**
   * Menjual barang dari tas inventaris ke pedagang seharga 50% dari harga dasar.
   */
  public sellItem(world: World, playerEntity: Entity, slotIndex: number): TransactionResult {
    const stats = world.getComponent(playerEntity, StatsComponent);
    const inventory = world.getComponent(playerEntity, InventoryComponent);

    if (!stats || !inventory) {
      return { success: false, message: 'Entitas tidak memiliki status atau inventaris.' };
    }

    if (slotIndex < 0 || slotIndex >= inventory.maxSlots) {
      return { success: false, message: 'Slot inventaris tidak valid.' };
    }

    const item = inventory.slots[slotIndex];
    if (!item) {
      return { success: false, message: 'Slot tas yang dipilih kosong.' };
    }

    const sellPrice = this.getItemSellPrice(item);
    const removed = inventory.removeItem(slotIndex, 1);
    if (!removed) {
      return { success: false, message: 'Gagal memproses penjualan barang.' };
    }

    stats.gold += sellPrice;

    // Sinkronisasi potion counter jika menjual ramuan
    if (item.id === 'potion_hp' && stats.hpPotions > 0) {
      stats.hpPotions--;
    } else if (item.id === 'potion_mp' && stats.mpPotions > 0) {
      stats.mpPotions--;
    }

    return {
      success: true,
      message: `Berhasil menjual 1x ${item.name} seharga ${sellPrice} G!`,
      costOrEarnings: sellPrice,
      item: removed,
    };
  }

  /**
   * Menghitung nilai jual barang ke toko.
   */
  public getItemSellPrice(item: Item): number {
    const shopItem = this.shopItems.find((i) => i.id === item.id);
    if (shopItem) {
      return Math.max(1, Math.floor(shopItem.cost * 0.5));
    }

    switch (item.rarity) {
      case 'legendary':
        return 80;
      case 'epic':
        return 40;
      case 'rare':
        return 20;
      case 'common':
      default:
        return 5;
    }
  }
}
