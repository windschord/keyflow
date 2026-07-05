export type MidiNoteCallback = (noteNumber: number, velocity: number, channel: number) => void;

export class WebMidiService {
  private access: MIDIAccess | null = null;
  private onNoteOnCallback: MidiNoteCallback | null = null;
  private onNoteOffCallback: MidiNoteCallback | null = null;
  /**
   * ユーザーが選択したMIDI入力デバイスのid（REQ-004-008）。
   * `null` は「すべてのデバイス」を意味し、従来どおり全入力をバインドする
   * （後方互換のデフォルト動作）。SettingsModalでの変更をこのフィールドに
   * 反映し、`rebindInputs` を呼び直すことで即座に反映する。
   */
  private selectedDeviceId: string | null = null;

  async initialize(): Promise<void> {
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => this.rebindInputs();
    this.rebindInputs();
  }

  onNoteOn(callback: MidiNoteCallback): void {
    this.onNoteOnCallback = callback;
  }

  onNoteOff(callback: MidiNoteCallback): void {
    this.onNoteOffCallback = callback;
  }

  getDevices(): Array<{ id: string; name: string }> {
    if (!this.access) return [];
    return Array.from(this.access.inputs.values()).map((input) => ({
      id: input.id,
      name: input.name ?? 'Unknown',
    }));
  }

  /**
   * 使用するMIDI入力デバイスを選択する（REQ-004-008）。`deviceId` が
   * `null` の場合は「すべてのデバイス」を意味し、従来どおり全入力から受け付ける。
   * `initialize()` が完了する前に呼ばれても例外を投げず、選択は保持され
   * 次回の `rebindInputs` （`initialize`完了時）で適用される。
   */
  setSelectedDevice(deviceId: string | null): void {
    this.selectedDeviceId = deviceId;
    this.rebindInputs();
  }

  getSelectedDevice(): string | null {
    return this.selectedDeviceId;
  }

  private rebindInputs(): void {
    if (!this.access) return;
    const inputs = Array.from(this.access.inputs.values());

    // 保存済みの選択デバイスが現在接続されていない場合は、例外を出さずに
    // 「すべてのデバイス」動作へフォールバックする（注意事項参照）。選択自体は
    // 保持されるため、該当デバイスが再接続されれば次回のonstatechangeで
    // 再度そのデバイスのみへ絞り込まれる。
    const selectedIsConnected =
      this.selectedDeviceId !== null && inputs.some((input) => input.id === this.selectedDeviceId);
    const effectiveDeviceId = selectedIsConnected ? this.selectedDeviceId : null;

    inputs.forEach((input) => {
      const shouldBind = effectiveDeviceId === null || input.id === effectiveDeviceId;
      input.onmidimessage = shouldBind ? (event: MIDIMessageEvent) => this.handleMessage(event) : null;
    });
  }

  private handleMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 3) return;
    const status = data[0];
    const noteNumber = data[1];
    const velocity = data[2];
    const channel = (status & 0x0f) + 1;
    const command = status & 0xf0;

    if (command === 0x90 && velocity > 0) {
      this.onNoteOnCallback?.(noteNumber, velocity, channel);
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      this.onNoteOffCallback?.(noteNumber, 0, channel);
    }
  }
}
