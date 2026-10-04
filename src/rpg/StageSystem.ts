import type { Entity } from '../ecs/Entity';
import { World } from '../ecs/World';
import { StatsComponent } from './RPGComponents';
import { InventoryComponent, createItem } from './InventorySystem';
import type { ChatManager } from './ChatSystem';
import type { SoundSynthesizer } from '../audio/SoundSynthesizer';

export interface StageDefinition {
  stageNumber: number;
  name: string;
  description: string;
  targetMonsterType: 'slime' | 'goblin' | 'wolf' | 'boss' | 'any';
  targetMonsterName?: string;
  requiredKills: number;
  rewardExp: number;
  rewardGold: number;
  rewardItemId?: string;
  rewardItemName?: string;
}

/**
 * StageSystem mengelola perkembangan stage progresif di dunia Sanctuary:
 * - Mengatur target pembasmian monster bertahap (Slime -> Goblin -> Serigala -> World Boss Fenrir -> Endless)
 * - Memberikan reward EXP, Gold, dan Item saat stage berhasil diselesaikan
 * - Mengatur waktu respawn musuh yang seimbang (20 detik untuk monster biasa, 45 detik untuk Boss)
 * - Menampilkan banner notifikasi kemenangan dan chat pengumuman otomatis
 */
export class StageSystem {
  public currentStageIndex: number = 0;
  public currentKills: number = 0;
  public bannerText: string = '';
  public bannerSubtext: string = '';
  public bannerTimer: number = 0;
  public readonly bannerDuration: number = 4.0;
  public totalStagesCleared: number = 0;

  public stages: StageDefinition[] = [
    {
      stageNumber: 1,
      name: 'Pembersihan Slime Hutan',
      description: 'Basmi 4 Slime di sekitar air terjun Sanctuary',
      targetMonsterType: 'slime',
      requiredKills: 4,
      rewardExp: 60,
      rewardGold: 50,
      rewardItemId: 'pot_hp',
      rewardItemName: 'Health Potion',
    },
    {
      stageNumber: 2,
      name: 'Serbuan Pos Goblin',
      description: 'Kalahkan 3 Prajurit Goblin di Goblin Glade',
      targetMonsterType: 'goblin',
      requiredKills: 3,
      rewardExp: 140,
      rewardGold: 120,
      rewardItemId: 'pot_mp',
      rewardItemName: 'Mana Potion',
    },
    {
      stageNumber: 3,
      name: 'Teror Kawanan Serigala',
      description: 'Tumpas 3 Dire Wolf di Wolf Woods timur',
      targetMonsterType: 'wolf',
      requiredKills: 3,
      rewardExp: 220,
      rewardGold: 180,
      rewardItemId: 'wpn_iron',
      rewardItemName: 'Pedang Tempa Besi',
    },
    {
      stageNumber: 4,
      name: 'Kebangkitan Alpha Wolf Fenrir',
      description: 'Kalahkan World Boss Fenrir Lv. 7 di sarang utara',
      targetMonsterType: 'boss',
      targetMonsterName: 'Alpha Wolf Fenrir',
      requiredKills: 1,
      rewardExp: 600,
      rewardGold: 450,
      rewardItemId: 'arm_knight',
      rewardItemName: 'Zirah Pelindung Ksatria',
    },
    {
      stageNumber: 5,
      name: 'Penjaga Abadi Sanctuary',
      description: 'Basmi 6 monster apa saja untuk menjaga keamanan dunia',
      targetMonsterType: 'any',
      requiredKills: 6,
      rewardExp: 300,
      rewardGold: 250,
      rewardItemId: 'pot_hp',
      rewardItemName: 'Health Potion',
    },
  ];

  /**
   * Mendapatkan definisi stage aktif saat ini.
   */
  public getCurrentStage(): StageDefinition {
    if (this.currentStageIndex < this.stages.length) {
      return this.stages[this.currentStageIndex];
    }

    // Untuk stage 5 ke atas (Endless Tier)
    const loopNumber = this.currentStageIndex + 1;
    return {
      stageNumber: loopNumber,
      name: `Penjaga Abadi Sanctuary (Tier ${loopNumber - 4})`,
      description: 'Basmi 6 monster apa saja untuk menjaga keamanan Sanctuary',
      targetMonsterType: 'any',
      requiredKills: 6,
      rewardExp: 300 + (loopNumber - 5) * 50,
      rewardGold: 250 + (loopNumber - 5) * 50,
      rewardItemId: 'pot_hp',
      rewardItemName: 'Health Potion',
    };
  }

  /**
   * Menghitung durasi respawn monster berdasarkan level dan status boss.
   * Memberikan waktu jeda yang cukup (20s normal, 45s boss) agar pemain tidak terburu-buru.
   */
  public getRespawnDelay(level: number, isBoss: boolean): number {
    if (isBoss || level >= 7) {
      return 45.0; // Boss respawn 45 detik
    }
    return 20.0; // Monster biasa respawn 20 detik
  }

  /**
   * Memproses kill monster dan memeriksa kelayakan penyelesaian stage.
   */
  public onMonsterKilled(
    monsterType: string,
    monsterName: string,
    world: World,
    playerEntity?: Entity | null,
    chatManager?: ChatManager,
    soundSynth?: SoundSynthesizer
  ): boolean {
    const stage = this.getCurrentStage();

    let matches = false;
    if (stage.targetMonsterType === 'any') {
      matches = true;
    } else if (stage.targetMonsterType === 'boss') {
      matches = monsterType === 'boss' || monsterName.toLowerCase().includes('fenrir');
    } else {
      matches = monsterType.toLowerCase() === stage.targetMonsterType.toLowerCase();
    }

    if (!matches) return false;

    this.currentKills++;

    if (chatManager) {
      chatManager.addMessage(
        'System',
        `[Stage ${stage.stageNumber}]: ${stage.name} (${this.currentKills}/${stage.requiredKills})`,
        'system'
      );
    }

    if (this.currentKills >= stage.requiredKills) {
      this.advanceStage(world, playerEntity, chatManager, soundSynth);
      return true;
    }

    return false;
  }

  /**
   * Menaikkan ke stage berikutnya, memberikan reward ke pemain, dan memicu efek banner.
   */
  public advanceStage(
    world: World,
    playerEntity?: Entity | null,
    chatManager?: ChatManager,
    soundSynth?: SoundSynthesizer
  ): void {
    const completedStage = this.getCurrentStage();
    this.totalStagesCleared++;
    this.currentKills = 0;
    this.currentStageIndex++;

    // 1. Berikan reward ke stats pemain
    if (playerEntity) {
      const stats = world.getComponent(playerEntity, StatsComponent);
      if (stats) {
        stats.gold += completedStage.rewardGold;
        stats.exp += completedStage.rewardExp;

        // Cek kenaikan level jika EXP cukup
        while (stats.exp >= stats.nextLevelExp) {
          stats.exp -= stats.nextLevelExp;
          stats.level++;
          stats.nextLevelExp = Math.round(stats.nextLevelExp * 1.5);
          stats.maxHp += 20;
          stats.hp = stats.maxHp;
          stats.maxMp += 10;
          stats.mp = stats.maxMp;
          stats.attack += 4;
          stats.defense += 2;
        }
      }

      // Berikan reward item ke tas inventaris jika ada slot kosong
      if (completedStage.rewardItemId) {
        const inv = world.getComponent(playerEntity, InventoryComponent);
        if (inv) {
          const item = createItem(completedStage.rewardItemId);
          if (item) {
            const added = inv.addItem(item);
            if (!added && stats) {
              // Jika tas penuh, tambahkan nilai emas ekstra
              stats.gold += 50;
            }
          }
        }
      }
    }

    // 2. Pasang banner pengumuman kemenangan stage
    const nextStage = this.getCurrentStage();
    this.bannerText = `⚔️ STAGE ${completedStage.stageNumber} SELESAI!`;
    this.bannerSubtext = `Reward: +${completedStage.rewardGold} G, +${completedStage.rewardExp} EXP | Lanjut: ${nextStage.name}`;
    this.bannerTimer = this.bannerDuration;

    // 3. Audio jingle kemenangan
    if (soundSynth) {
      soundSynth.playLevelUp();
    }

    // 4. Log chat pengumuman dunia
    if (chatManager) {
      chatManager.addMessage(
        'System',
        `🎉 SELAMAT! Stage ${completedStage.stageNumber}: ${completedStage.name} berhasil diselesaikan!`,
        'system'
      );
      chatManager.addMessage(
        'System',
        `⚔️ Misi Baru Dimulai: Stage ${nextStage.stageNumber} - ${nextStage.description}`,
        'system'
      );
    }
  }

  /**
   * Mengupdate timer banner per frame.
   */
  public update(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    }
  }

  /**
   * String status ringkas untuk badge di header HTML.
   */
  public getStageBadgeString(): string {
    const stage = this.getCurrentStage();
    return `⚔️ Stage ${stage.stageNumber}: ${this.currentKills}/${stage.requiredKills}`;
  }

  /**
   * String status lengkap untuk UI HUD Canvas.
   */
  public getStageStatusString(): string {
    const stage = this.getCurrentStage();
    return `Stage ${stage.stageNumber}: ${stage.name} (${this.currentKills}/${stage.requiredKills})`;
  }

  /**
   * Rasio progres pembasmian monster untuk progress bar HUD (clamped 0.0 sampai 1.0).
   */
  public getKillProgressRatio(): number {
    const stage = this.getCurrentStage();
    if (stage.requiredKills <= 0) return 1.0;
    return Math.min(1.0, Math.max(0.0, this.currentKills / stage.requiredKills));
  }

  /**
   * Reset ke stage awal.
   */
  public reset(): void {
    this.currentStageIndex = 0;
    this.currentKills = 0;
    this.bannerText = '';
    this.bannerSubtext = '';
    this.bannerTimer = 0;
    this.totalStagesCleared = 0;
  }
}
