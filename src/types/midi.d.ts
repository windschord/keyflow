declare module 'midi' {
  export class Input {
    constructor();
    getPortCount(): number;
    getPortName(port: number): string;
    openPort(port: number): void;
    closePort(): void;
    openVirtualPort(name: string): void;
    ignoreTypes(sysex: boolean, timing: boolean, activeSensing: boolean): void;
    on(event: 'message', callback: (deltaTime: number, message: number[]) => void): void;
  }

  export class Output {
    constructor();
    getPortCount(): number;
    getPortName(port: number): string;
    openPort(port: number): void;
    closePort(): void;
    openVirtualPort(name: string): void;
    sendMessage(message: number[]): void;
  }
}
