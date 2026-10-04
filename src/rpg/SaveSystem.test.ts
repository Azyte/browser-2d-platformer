// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { SaveSystem, type SaveData } from './SaveSystem';
import { InventoryComponent, createItem } from './InventorySystem';
import { StatsComponent } from './RPGComponents';
import { TransformComponent } from '../physics/TransformComponent';
import { StageSystem } from './StageSystem';

describe('SaveSystem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockSaveData: SaveData = {
    version: 1,
    timestamp: Date.now(),
    stage: {
      currentStageIndex: 2,
      currentKills: 1,
      totalStagesCleared: 2,
    },
    player: {
      level: 4,
      exp: 150,
      gold: 240,
      hp: 85,
      maxHp: 120,
      attack: 22,
      defense: 14,
      x: 500,
      y: 600,
    },
    inventory: {
      slots: [createItem('pot_hp'), null],
      equipment: {
        weapon: createItem('iron_longsword'),
        armor: null,
        accessory: null,
      },
    },
    settings: {
      volume: 0.5,
      isMuted: false,
      isLightingEnabled: true,
    },
  };

  it('mengembalikan false ketika belum ada data simpanan', () => {
    expect(SaveSystem.hasSave()).toBe(false);
    expect(SaveSystem.load()).toBeNull();
  });

  it('berhasil menyimpan dan membaca kembali data simpanan', () => {
    const success = SaveSystem.save(mockSaveData);
    expect(success).toBe(true);
    expect(SaveSystem.hasSave()).toBe(true);

    const loaded = SaveSystem.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.player.level).toBe(4);
    expect(loaded?.player.gold).toBe(240);
    expect(loaded?.stage.currentStageIndex).toBe(2);
    expect(loaded?.inventory.equipment.weapon?.id).toBe('iron_longsword');
  });

  it('berhasil menghapus data simpanan', () => {
    SaveSystem.save(mockSaveData);
    expect(SaveSystem.hasSave()).toBe(true);

    SaveSystem.clear();
    expect(SaveSystem.hasSave()).toBe(false);
    expect(SaveSystem.load()).toBeNull();
  });

  it('menangani data korup di localStorage dengan aman', () => {
    localStorage.setItem(SaveSystem.STORAGE_KEY, '{ invalid_json ');
    expect(SaveSystem.hasSave()).toBe(false);
    expect(SaveSystem.load()).toBeNull();
  });

  it('mampu mengekstrak data dari komponen game dan menerapkannya kembali', () => {
    const stats = new StatsComponent({
      level: 5,
      maxHp: 130,
      hp: 95,
      attack: 25,
      defense: 15,
      gold: 300,
      exp: 200,
    });
    const transform = new TransformComponent(650, 720);
    const inv = new InventoryComponent(16);
    const item = createItem('pot_mp')!;
    item.quantity = 2;
    inv.addItem(item);
    const stage = new StageSystem();
    stage.currentStageIndex = 1;
    stage.currentKills = 2;

    const data = SaveSystem.createSaveData({
      stats,
      transform,
      inventory: inv,
      stageSystem: stage,
      settings: {
        volume: 0.4,
        isMuted: false,
        isLightingEnabled: true,
      },
    });

    expect(data.player.level).toBe(5);
    expect(data.player.hp).toBe(95);
    expect(data.player.gold).toBe(300);
    expect(data.player.x).toBe(650);
    expect(data.stage.currentStageIndex).toBe(1);

    // Sekarang simulasikan apply ke komponen baru
    const newStats = new StatsComponent({
      level: 1,
      maxHp: 100,
      hp: 100,
      attack: 10,
      defense: 5,
      gold: 0,
    });
    const newTransform = new TransformComponent(0, 0);
    const newInv = new InventoryComponent(16);
    const newStage = new StageSystem();

    SaveSystem.applySaveData(data, {
      stats: newStats,
      transform: newTransform,
      inventory: newInv,
      stageSystem: newStage,
    });

    expect(newStats.level).toBe(5);
    expect(newStats.hp).toBe(95);
    expect(newStats.gold).toBe(300);
    expect(newTransform.x).toBe(650);
    expect(newTransform.y).toBe(720);
    expect(newStage.currentStageIndex).toBe(1);
    expect(newStage.currentKills).toBe(2);
    expect(newInv.slots[0]?.id).toBe('potion_mp');
  });
});
