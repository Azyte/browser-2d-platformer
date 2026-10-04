import { describe, it, expect, beforeEach } from 'vitest';
import { StageSystem } from './StageSystem';
import { World } from '../ecs/World';
import { StatsComponent } from './RPGComponents';
import { createStarterInventory } from './InventorySystem';

describe('StageSystem', () => {
  let stageSystem: StageSystem;
  let world: World;

  beforeEach(() => {
    stageSystem = new StageSystem();
    world = new World();
  });

  it('harus menginisialisasi stage 1 dengan target Slime', () => {
    const stage = stageSystem.getCurrentStage();
    expect(stage.stageNumber).toBe(1);
    expect(stage.targetMonsterType).toBe('slime');
    expect(stage.requiredKills).toBe(4);
    expect(stageSystem.currentKills).toBe(0);
    expect(stageSystem.getStageBadgeString()).toBe('⚔️ Stage 1: 0/4');
  });

  it('harus mengabaikan kill monster yang tidak sesuai target stage aktif', () => {
    // Stage 1 menargetkan slime, bukan wolf
    const advanced = stageSystem.onMonsterKilled('wolf', 'Timber Wolf', world);
    expect(advanced).toBe(false);
    expect(stageSystem.currentKills).toBe(0);
  });

  it('harus menambah jumlah kill saat monster sesuai dibasmi', () => {
    stageSystem.onMonsterKilled('slime', 'Forest Slime', world);
    expect(stageSystem.currentKills).toBe(1);
    expect(stageSystem.getStageBadgeString()).toBe('⚔️ Stage 1: 1/4');
  });

  it('harus menyelesaikan stage dan memberikan reward saat kuota terpenuhi', () => {
    const player = world.createEntity();
    world.addComponent(
      player,
      new StatsComponent({
        hp: 100,
        maxHp: 100,
        gold: 10,
        exp: 0,
        level: 1,
      })
    );
    world.addComponent(player, createStarterInventory());

    // Bunuh 3 slime
    stageSystem.onMonsterKilled('slime', 'Forest Slime', world, player);
    stageSystem.onMonsterKilled('slime', 'Forest Slime', world, player);
    stageSystem.onMonsterKilled('slime', 'Forest Slime', world, player);
    expect(stageSystem.currentKills).toBe(3);

    // Bunuh slime ke-4 -> Harus menyelesaikan Stage 1 dan maju ke Stage 2
    const cleared = stageSystem.onMonsterKilled('slime', 'Forest Slime', world, player);
    expect(cleared).toBe(true);
    expect(stageSystem.totalStagesCleared).toBe(1);
    expect(stageSystem.bannerTimer).toBeGreaterThan(0);
    expect(stageSystem.bannerText).toContain('STAGE 1 SELESAI');

    // Stats pemain harus bertambah
    const stats = world.getComponent(player, StatsComponent)!;
    expect(stats.gold).toBeGreaterThan(10); // +50 gold dari reward
    expect(stats.exp).toBeGreaterThan(0); // +60 exp dari reward

    // Stage aktif sekarang harus Stage 2 (Goblin)
    const nextStage = stageSystem.getCurrentStage();
    expect(nextStage.stageNumber).toBe(2);
    expect(nextStage.targetMonsterType).toBe('goblin');
    expect(stageSystem.currentKills).toBe(0);
  });

  it('harus mengatur waktu respawn yang proporsional dan tidak terburu-buru', () => {
    // Normal monster: 20 detik
    const normalRespawn = stageSystem.getRespawnDelay(1, false);
    expect(normalRespawn).toBe(20.0);

    // Wolf Lv 4: 20 detik
    const wolfRespawn = stageSystem.getRespawnDelay(4, false);
    expect(wolfRespawn).toBe(20.0);

    // World Boss Fenrir (Lv 7): 45 detik
    const bossRespawn = stageSystem.getRespawnDelay(7, true);
    expect(bossRespawn).toBe(45.0);
  });

  it('harus mendukung Endless Tier untuk stage lanjutan di atas stage 5', () => {
    // Lompatkan index ke stage 5 (index 4)
    stageSystem.currentStageIndex = 4;
    expect(stageSystem.getCurrentStage().stageNumber).toBe(5);

    // Selesaikan stage 5
    stageSystem.advanceStage(world);
    expect(stageSystem.currentStageIndex).toBe(5);

    // Stage 6 (Endless Tier 2)
    const stage6 = stageSystem.getCurrentStage();
    expect(stage6.stageNumber).toBe(6);
    expect(stage6.targetMonsterType).toBe('any');
    expect(stage6.name).toContain('Tier 2');
  });

  it('harus mengupdate timer banner secara berkurang', () => {
    stageSystem.bannerTimer = 4.0;
    stageSystem.update(1.5);
    expect(stageSystem.bannerTimer).toBeCloseTo(2.5, 2);

    stageSystem.update(3.0);
    expect(stageSystem.bannerTimer).toBe(0);
  });

  it('harus menghitung rasio progres kill secara proporsional dan ter-clamp', () => {
    // Stage 1 butuh 4 kills
    expect(stageSystem.getKillProgressRatio()).toBe(0.0);

    stageSystem.currentKills = 2;
    expect(stageSystem.getKillProgressRatio()).toBe(0.5);

    stageSystem.currentKills = 4;
    expect(stageSystem.getKillProgressRatio()).toBe(1.0);

    stageSystem.currentKills = 6;
    expect(stageSystem.getKillProgressRatio()).toBe(1.0);
  });
});
