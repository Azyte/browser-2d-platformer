import type { Entity } from '../ecs/Entity';
import type { World } from '../ecs/World';
import { TransformComponent } from '../physics/TransformComponent';
import { StatsComponent } from './RPGComponents';
import type { CombatSystem } from './CombatSystem';
import type { ChatManager } from './ChatSystem';
import type { SoundSynthesizer } from '../audio/SoundSynthesizer';

export interface DialogueOption {
  text: string;
  nextNodeId?: string;
  action?: 'heal_buff' | 'give_quest' | 'farewell' | 'reward' | 'open_shop';
  responseFeedback?: string;
}

export interface DialogueNode {
  id: string;
  npcText: string;
  options: DialogueOption[];
}

export interface DialogueTree {
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

export interface NPCComponentOptions {
  npcId: string;
  name: string;
  title?: string;
  dialogueTree: DialogueTree;
  interactionRadius?: number;
  markerType?: 'quest' | 'chat' | 'shop' | 'none';
}

/**
 * NPCComponent menyimpan identitas NPC, pohon percakapan interaktif,
 * dan jangkauan radius interaksi dengan pemain.
 */
export class NPCComponent {
  public npcId: string;
  public name: string;
  public title: string;
  public dialogueTree: DialogueTree;
  public interactionRadius: number;
  public currentNodeId: string;
  public hasBlessedPlayer: boolean = false;
  public markerType: 'quest' | 'chat' | 'shop' | 'none';

  constructor(options: NPCComponentOptions) {
    this.npcId = options.npcId;
    this.name = options.name;
    this.title = options.title ?? 'NPC';
    this.dialogueTree = options.dialogueTree;
    this.interactionRadius = options.interactionRadius ?? 60;
    this.currentNodeId = options.dialogueTree.startNodeId;
    this.markerType = options.markerType ?? 'quest';
  }
}

/**
 * Membuat pohon dialog interaktif untuk Pedagang Elric di Sanctuary.
 */
export function createMerchantElricDialogue(): DialogueTree {
  return {
    startNodeId: 'greeting',
    nodes: {
      greeting: {
        id: 'greeting',
        npcText:
          'Selamat datang di Toko Perlengkapan Sanctuary! Saya Elric. Saya menyediakan senjata tempaan terbaik, zirah kokoh, dan ramuan segar untuk petualang.',
        options: [
          { text: '1. Buka Toko (Beli & Jual Perlengkapan)', action: 'open_shop' },
          { text: '2. Barang apa yang paling kamu rekomendasikan?', nextNodeId: 'advice' },
          { text: '3. Sampai jumpa lagi, Elric.', action: 'farewell' },
        ],
      },
      advice: {
        id: 'advice',
        npcText:
          'Jika kamu hendak berburu di Hutan Utara, pasanglah Zirah Guardian Plate dan bawa pedang tajam Valiant Claymore! Dan jangan lupa sediakan Health Potion cadangan.',
        options: [
          { text: '1. Baik, mari buka tokomu sekarang.', action: 'open_shop' },
          { text: '2. Terima kasih banyak atas sarannya.', action: 'farewell' },
        ],
      },
    },
  };
}

/**
 * Membuat pohon dialog interaktif untuk Tetua Rowan di pusat Sanctuary.
 */
export function createElderRowanDialogue(): DialogueTree {
  return {
    startNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        npcText:
          'Salam hangat, Ksatria Pelindung! Selamat datang di Emerald Sanctuary. Hutan di sekitar kita sedang terusik oleh monster buas.',
        options: [
          {
            text: '1. Ceritakan tentang monster di sekitar Sanctuary.',
            nextNodeId: 'lore',
          },
          {
            text: '2. Mohon berkati luka saya, Tetua (Pulihkan HP).',
            nextNodeId: 'blessing',
            action: 'heal_buff',
          },
          {
            text: '3. Saya akan melanjutkan penjelajahan. Sampai jumpa!',
            action: 'farewell',
          },
        ],
      },
      lore: {
        id: 'lore',
        npcText:
          'Di padang rumput timur terdapat Forest Slimes yang kenyal. Lebih jauh ke timur laut, Goblin Glade dihuni prajurit goblin serakah. Di puncak hutan Wolf Woods bersemayam Alpha Wolf Fenrir yang mematikan!',
        options: [
          {
            text: '1. Terima kasih informasinya, Tetua Rowan.',
            nextNodeId: 'root',
          },
          {
            text: '2. Saya siap bertarung!',
            action: 'farewell',
          },
        ],
      },
      blessing: {
        id: 'blessing',
        npcText:
          'Terimalah Berkah Cahaya Suci (Blessing of the Sanctuary)! Semoga vitalitasmu kembali penuh dan langkahmu dilindungi para leluhur.',
        options: [
          {
            text: '1. Terima kasih banyak, Tetua!',
            nextNodeId: 'root',
          },
          {
            text: '2. Pamit berkelana.',
            action: 'farewell',
          },
        ],
      },
    },
  };
}

/**
 * NPCSystem mengelola pendeteksian radius interaksi, pembukaan modal dialog,
 * navigasi percabangan percakapan, serta pemberian berkah/hadiah dari NPC ke pemain.
 */
export class NPCSystem {
  public activeNPC: Entity | null = null;
  public activeNPCComp: NPCComponent | null = null;
  public isDialogueOpen: boolean = false;
  public nearbyNPC: Entity | null = null;

  /**
   * Memeriksa apakah ada NPC dalam jangkauan interaksi pemain.
   */
  public checkNearbyNPC(world: World, player: Entity): Entity | null {
    const pTrans = world.getComponent(player, TransformComponent);
    if (!pTrans) {
      this.nearbyNPC = null;
      return null;
    }

    const npcs = world.query(NPCComponent, TransformComponent);
    let closestNPC: Entity | null = null;
    let minDistance = Infinity;

    for (const npc of npcs) {
      const npcComp = world.getComponent(npc, NPCComponent);
      const npcTrans = world.getComponent(npc, TransformComponent);
      if (!npcComp || !npcTrans) continue;

      const dx = npcTrans.x - pTrans.x;
      const dy = npcTrans.y - pTrans.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= npcComp.interactionRadius && dist < minDistance) {
        minDistance = dist;
        closestNPC = npc;
      }
    }

    this.nearbyNPC = closestNPC;
    return closestNPC;
  }

  /**
   * Memulai percakapan dengan NPC.
   */
  public startDialogue(npcEntity: Entity, world: World): void {
    const npcComp = world.getComponent(npcEntity, NPCComponent);
    if (!npcComp) return;

    this.activeNPC = npcEntity;
    this.activeNPCComp = npcComp;
    this.isDialogueOpen = true;
    npcComp.currentNodeId = npcComp.dialogueTree.startNodeId;
  }

  /**
   * Menutup jendela dialog.
   */
  public closeDialogue(): void {
    this.isDialogueOpen = false;
    this.activeNPC = null;
    this.activeNPCComp = null;
  }

  /**
   * Mengambil data node percakapan aktif saat ini.
   */
  public getCurrentNode(world?: World): DialogueNode | null {
    if (!this.activeNPC || !this.isDialogueOpen) return null;

    const comp = this.activeNPCComp ?? (world ? world.getComponent(this.activeNPC, NPCComponent) : null);
    if (!comp) return null;

    return comp.dialogueTree.nodes[comp.currentNodeId] ?? null;
  }

  /**
   * Memilih opsi jawaban pada node percakapan saat ini.
   */
  public chooseOption(
    optionIndex: number,
    world: World,
    player: Entity,
    chatManager?: ChatManager,
    combatSystem?: CombatSystem,
    soundSynth?: SoundSynthesizer
  ): DialogueOption | null {
    if (!this.activeNPC || !this.isDialogueOpen) return null;

    const npcComp = world.getComponent(this.activeNPC, NPCComponent);
    if (!npcComp) return null;

    const currentNode = npcComp.dialogueTree.nodes[npcComp.currentNodeId];
    if (!currentNode || optionIndex < 0 || optionIndex >= currentNode.options.length) {
      return null;
    }

    const selectedOption = currentNode.options[optionIndex];

    // Eksekusi aksi opsi jika ada
    if (selectedOption.action === 'heal_buff') {
      const pStats = world.getComponent(player, StatsComponent);
      const pTrans = world.getComponent(player, TransformComponent);
      if (pStats) {
        const healAmt = pStats.maxHp - pStats.hp;
        pStats.hp = pStats.maxHp;
        pStats.mp = pStats.maxMp;

        if (combatSystem && pTrans) {
          combatSystem.spawnFloatingText(
            world,
            pTrans.x + 8,
            pTrans.y - 16,
            `Full Recovery (+${healAmt} HP)!`,
            '#3fb950',
            true
          );
        }
      }

      if (chatManager) {
        chatManager.addMessage(
          npcComp.name,
          'Semoga Berkah Cahaya memulihkan seluruh luka dan manamu!',
          'system'
        );
      }

      if (soundSynth) {
        soundSynth.playPotion();
      }
    } else if (selectedOption.action === 'reward') {
      const pStats = world.getComponent(player, StatsComponent);
      if (pStats) {
        pStats.gold += 50;
      }
      if (chatManager) {
        chatManager.addMessage(
          npcComp.name,
          'Hadiah 50 Gold diberikan kepadamu!',
          'system'
        );
      }
    }

    // Pindah ke node selanjutnya atau tutup dialog
    if (
      selectedOption.action === 'farewell' ||
      selectedOption.action === 'open_shop' ||
      !selectedOption.nextNodeId
    ) {
      this.closeDialogue();
    } else {
      npcComp.currentNodeId = selectedOption.nextNodeId;
    }

    return selectedOption;
  }
}
