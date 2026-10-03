import type { Entity } from '../ecs/Entity';
import type { World } from '../ecs/World';
import { StatsComponent } from './RPGComponents';
import { TransformComponent } from '../physics/TransformComponent';
import type { CombatSystem } from './CombatSystem';
import type { ChatManager } from './ChatSystem';
import type { SoundSynthesizer } from '../audio/SoundSynthesizer';

export interface Quest {
  id: string;
  title: string;
  description: string;
  targetName: string;
  requiredCount: number;
  currentCount: number;
  expReward: number;
  goldReward: number;
  itemReward?: string;
  isCompleted: boolean;
  isClaimed: boolean;
}

/**
 * QuestManager mengelola daftar misi berburu, progres objektif, dan pembagian reward.
 */
export class QuestManager {
  private readonly quests: Map<string, Quest> = new Map();

  constructor() {
    this.initDefaultQuests();
  }

  /**
   * Mendaftarkan misi awal standar dunia MMORPG.
   */
  private initDefaultQuests(): void {
    this.addQuest({
      id: 'quest_slimes',
      title: 'Culling the Slimes',
      description: 'Hunt 3 Forest Slimes around the sanctuary',
      targetName: 'Forest Slime',
      requiredCount: 3,
      currentCount: 0,
      expReward: 60,
      goldReward: 40,
      isCompleted: false,
      isClaimed: false,
    });

    this.addQuest({
      id: 'quest_goblins',
      title: 'Goblin Glade Raid',
      description: 'Eliminate 2 Goblin Raiders in the forest',
      targetName: 'Goblin Raider',
      requiredCount: 2,
      currentCount: 0,
      expReward: 120,
      goldReward: 80,
      isCompleted: false,
      isClaimed: false,
    });

    this.addQuest({
      id: 'quest_fenrir',
      title: 'Bounty: Alpha Wolf Fenrir',
      description: 'Defeat the ferocious World Boss Alpha Wolf Fenrir',
      targetName: 'Alpha Wolf Fenrir',
      requiredCount: 1,
      currentCount: 0,
      expReward: 450,
      goldReward: 300,
      isCompleted: false,
      isClaimed: false,
    });
  }

  /**
   * Menambahkan misi baru ke dalam daftar pantauan.
   */
  public addQuest(quest: Quest): void {
    this.quests.set(quest.id, quest);
  }

  /**
   * Mengambil misi berdasarkan ID.
   */
  public getQuest(id: string): Quest | undefined {
    return this.quests.get(id);
  }

  /**
   * Mengambil seluruh daftar misi aktif.
   */
  public getAllQuests(): Quest[] {
    return Array.from(this.quests.values());
  }

  /**
   * Memperbarui progres misi saat monster berhasil dikalahkan.
   * Memberikan EXP, Gold, notifikasi chat, dan floating text jika misi selesai.
   */
  public onMonsterKilled(
    monsterName: string,
    world: World,
    player: Entity,
    combatSystem: CombatSystem,
    chatManager: ChatManager,
    audio?: SoundSynthesizer
  ): Quest | null {
    for (const quest of this.quests.values()) {
      if (quest.isCompleted) continue;

      if (quest.targetName.toLowerCase() === monsterName.toLowerCase()) {
        quest.currentCount++;

        if (quest.currentCount >= quest.requiredCount) {
          quest.currentCount = quest.requiredCount;
          quest.isCompleted = true;
          quest.isClaimed = true;

          // Beri reward ke pemain
          const playerStats = world.getComponent(player, StatsComponent);
          const playerTrans = world.getComponent(player, TransformComponent);

          if (playerStats) {
            playerStats.gold += quest.goldReward;
            combatSystem.rewardExp(world, player, quest.expReward);
          }

          if (playerTrans) {
            combatSystem.spawnFloatingText(
              world,
              playerTrans.x - 10,
              playerTrans.y - 25,
              `QUEST COMPLETE: ${quest.title}!`,
              '#e3b341',
              true
            );
          }

          chatManager.addMessage(
            'System',
            `Quest Complete: [${quest.title}]! Received +${quest.expReward} EXP & +${quest.goldReward} Gold!`,
            'system'
          );

          if (audio) {
            audio.playQuestComplete();
          }

          return quest;
        } else {
          chatManager.addMessage(
            'System',
            `[${quest.title}]: (${quest.currentCount}/${quest.requiredCount}) ${quest.targetName} defeated.`,
            'system'
          );
        }
      }
    }

    return null;
  }
}
