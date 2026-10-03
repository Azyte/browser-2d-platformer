import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/World';
import { StatsComponent } from './RPGComponents';
import { InventoryComponent } from './InventorySystem';
import { ShopSystem, getDefaultShopCatalog } from './ShopSystem';

describe('ShopSystem (NPC Merchant & Gold Economy)', () => {
  let world: World;
  let shop: ShopSystem;
  let player: number;

  beforeEach(() => {
    world = new World();
    shop = new ShopSystem();
    player = world.createEntity();

    world.addComponent(
      player,
      new StatsComponent({
        gold: 150,
        hpPotions: 2,
        mpPotions: 1,
      })
    );

    const inventory = new InventoryComponent(8);
    world.addComponent(player, inventory);
  });

  it('memuat katalog toko default dengan barang beragam', () => {
    const catalog = getDefaultShopCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(4);
    expect(catalog.some((item) => item.id === 'potion_hp')).toBe(true);
    expect(catalog.some((item) => item.id === 'claymore_valiant')).toBe(true);
    expect(catalog.some((item) => item.id === 'plate_guardian')).toBe(true);
  });

  it('bisa membuka, menutup, dan melakukan toggle status modal toko', () => {
    expect(shop.isOpen).toBe(false);
    shop.open();
    expect(shop.isOpen).toBe(true);
    shop.close();
    expect(shop.isOpen).toBe(false);
    expect(shop.toggle()).toBe(true);
    expect(shop.toggle()).toBe(false);
  });

  it('berhasil membeli barang ketika saldo gold mencukupi dan slot tas tersedia', () => {
    const stats = world.getComponent(player, StatsComponent)!;
    const inv = world.getComponent(player, InventoryComponent)!;

    const result = shop.buyItem(world, player, 'potion_hp');
    expect(result.success).toBe(true);
    expect(stats.gold).toBe(150 - 15);
    expect(stats.hpPotions).toBe(3); // 2 + 1
    expect(inv.slots[0]?.id).toBe('potion_hp');
  });

  it('menolak pembelian jika saldo gold pemain tidak mencukupi', () => {
    const stats = world.getComponent(player, StatsComponent)!;
    stats.gold = 10; // kurang untuk beli claymore seharga 75

    const result = shop.buyItem(world, player, 'claymore_valiant');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Gold tidak mencukupi');
    expect(stats.gold).toBe(10);
  });

  it('menolak pembelian jika tas inventaris penuh', () => {
    const stats = world.getComponent(player, StatsComponent)!;
    const inv = world.getComponent(player, InventoryComponent)!;

    // Penuhi seluruh 8 slot tas dengan item dummy yang tidak stackable
    for (let i = 0; i < inv.maxSlots; i++) {
      inv.slots[i] = {
        id: `dummy_${i}`,
        name: `Dummy Item ${i}`,
        type: 'weapon',
        rarity: 'common',
        description: 'Test item',
        quantity: 1,
        maxStack: 1,
      };
    }

    const result = shop.buyItem(world, player, 'claymore_valiant');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Tas inventaris penuh');
    expect(stats.gold).toBe(150); // Gold tidak terpotong
  });

  it('berhasil menjual barang dari tas inventaris dan menambahkan gold ke pemain', () => {
    const stats = world.getComponent(player, StatsComponent)!;
    const inv = world.getComponent(player, InventoryComponent)!;

    // Pasang item di slot 0: Claymore seharga 75 (harga jual 50% = 37 G)
    inv.slots[0] = {
      id: 'claymore_valiant',
      name: 'Valiant Claymore',
      type: 'weapon',
      rarity: 'rare',
      description: 'Test weapon',
      quantity: 1,
    };

    const initialGold = stats.gold;
    const result = shop.sellItem(world, player, 0);

    expect(result.success).toBe(true);
    expect(result.costOrEarnings).toBe(37);
    expect(stats.gold).toBe(initialGold + 37);
    expect(inv.slots[0]).toBeNull();
  });

  it('menolak penjualan jika slot yang dipilih kosong atau indeks tidak valid', () => {
    const result1 = shop.sellItem(world, player, 0); // slot 0 kosong
    expect(result1.success).toBe(false);

    const result2 = shop.sellItem(world, player, 99); // index di luar batas
    expect(result2.success).toBe(false);
  });
});
