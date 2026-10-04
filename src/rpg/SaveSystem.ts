import type { StatsComponent } from './RPGComponents';
import type { TransformComponent } from '../physics/TransformComponent';
import type { InventoryComponent, Item, EquipSlot } from './InventorySystem';
import type { StageSystem } from './StageSystem';

export interface GameSettingsData {
  volume: number;
  isMuted: boolean;
  isLightingEnabled: boolean;
}

export interface SaveData {
  version: number;
  timestamp: number;
  stage: {
    currentStageIndex: number;
    currentKills: number;
    totalStagesCleared: number;
  };
  player: {
    level: number;
    exp: number;
    gold: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    x: number;
    y: number;
  };
  inventory: {
    slots: (Item | null)[];
    equipment: Record<EquipSlot, Item | null>;
  };
  settings: GameSettingsData;
}

export interface ExtractSaveParams {
  stats: StatsComponent;
  transform: TransformComponent;
  inventory: InventoryComponent;
  stageSystem: StageSystem;
  settings: GameSettingsData;
}

export interface ApplySaveParams {
  stats: StatsComponent;
  transform: TransformComponent;
  inventory: InventoryComponent;
  stageSystem: StageSystem;
}

export class SaveSystem {
  public static readonly STORAGE_KEY = 'aethelgard_save_v1';

  /**
   * Mengecek apakah ada data simpanan valid di localStorage.
   */
  public static hasSave(): boolean {
    const raw = this.getRawData();
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.version && parsed.player && parsed.stage);
    } catch {
      return false;
    }
  }

  /**
   * Menyimpan data permainan ke localStorage.
   */
  public static save(data: SaveData): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const json = JSON.stringify(data);
      window.localStorage.setItem(this.STORAGE_KEY, json);
      return true;
    } catch (e) {
      console.error('Gagal menyimpan data game:', e);
      return false;
    }
  }

  /**
   * Membaca dan mengembalikan data simpanan dari localStorage.
   */
  public static load(): SaveData | null {
    const raw = this.getRawData();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SaveData;
      if (!parsed || !parsed.version || !parsed.player || !parsed.stage) {
        return null;
      }
      return parsed;
    } catch (e) {
      console.error('Gagal membaca data simpanan yang rusak:', e);
      return null;
    }
  }

  /**
   * Menghapus data simpanan dari localStorage.
   */
  public static clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (e) {
      console.error('Gagal menghapus data simpanan:', e);
    }
  }

  /**
   * Mengumpulkan state game aktif menjadi objek SaveData.
   */
  public static createSaveData(params: ExtractSaveParams): SaveData {
    return {
      version: 1,
      timestamp: Date.now(),
      stage: {
        currentStageIndex: params.stageSystem.currentStageIndex,
        currentKills: params.stageSystem.currentKills,
        totalStagesCleared: params.stageSystem.totalStagesCleared,
      },
      player: {
        level: params.stats.level,
        exp: params.stats.exp,
        gold: params.stats.gold,
        hp: params.stats.hp,
        maxHp: params.stats.maxHp,
        attack: params.stats.attack,
        defense: params.stats.defense,
        x: Math.round(params.transform.x),
        y: Math.round(params.transform.y),
      },
      inventory: {
        slots: params.inventory.slots.map((s) => (s ? { ...s } : null)),
        equipment: {
          weapon: params.inventory.equipment.weapon ? { ...params.inventory.equipment.weapon } : null,
          armor: params.inventory.equipment.armor ? { ...params.inventory.equipment.armor } : null,
          accessory: params.inventory.equipment.accessory ? { ...params.inventory.equipment.accessory } : null,
        },
      },
      settings: { ...params.settings },
    };
  }

  /**
   * Menerapkan data simpanan ke dalam komponen game aktif.
   */
  public static applySaveData(data: SaveData, targets: ApplySaveParams): void {
    // 1. Terapkan data pemain
    targets.stats.level = data.player.level;
    targets.stats.exp = data.player.exp;
    targets.stats.gold = data.player.gold;
    targets.stats.maxHp = data.player.maxHp;
    targets.stats.hp = Math.min(data.player.hp, data.player.maxHp);
    targets.stats.attack = data.player.attack;
    targets.stats.defense = data.player.defense;
    targets.transform.x = data.player.x;
    targets.transform.y = data.player.y;

    // 2. Terapkan data stage
    targets.stageSystem.currentStageIndex = data.stage.currentStageIndex;
    targets.stageSystem.currentKills = data.stage.currentKills;
    targets.stageSystem.totalStagesCleared = data.stage.totalStagesCleared;

    // 3. Terapkan inventori
    if (data.inventory && Array.isArray(data.inventory.slots)) {
      targets.inventory.slots = data.inventory.slots.map((s) => (s ? { ...s } : null));
    }
    if (data.inventory && data.inventory.equipment) {
      targets.inventory.equipment = {
        weapon: data.inventory.equipment.weapon ? { ...data.inventory.equipment.weapon } : null,
        armor: data.inventory.equipment.armor ? { ...data.inventory.equipment.armor } : null,
        accessory: data.inventory.equipment.accessory ? { ...data.inventory.equipment.accessory } : null,
      };
    }
  }

  private static getRawData(): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      return window.localStorage.getItem(this.STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
