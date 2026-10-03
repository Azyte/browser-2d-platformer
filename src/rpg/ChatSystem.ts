export type ChatRole = 'system' | 'player' | 'other_player' | 'guild';

export interface ChatMessage {
  sender: string;
  role: ChatRole;
  text: string;
  timestamp: string;
}

/**
 * ChatManager mengelola log percakapan MMO global:
 * Pesan sistem, obrolan pemain utama, dan pesan simulasi dari bot pemain lain.
 */
export class ChatManager {
  private readonly messages: ChatMessage[] = [];
  public maxMessages: number;

  constructor(maxMessages: number = 40) {
    this.maxMessages = maxMessages;
  }

  /**
   * Menambahkan pesan baru ke dalam chat log.
   */
  public addMessage(
    sender: string,
    text: string,
    role: ChatRole = 'other_player'
  ): void {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    this.messages.push({ sender, role, text, timestamp: time });

    // ⚠️ EDGE CASE: Batasi ukuran antrean pesan agar memori tidak bocor (leak) di long-running game loop.
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }

  /**
   * Mengambil daftar pesan untuk dirender di UI.
   */
  public getMessages(): readonly ChatMessage[] {
    return this.messages;
  }

  /**
   * Menghapus seluruh pesan di chat log.
   */
  public clear(): void {
    this.messages.length = 0;
  }
}
