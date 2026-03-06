
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const ROTORS: Record<string, { wiring: string; notch: string }> = {
  I: { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  II: { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
  IV: { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
  V: { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' },
};

export const REFLECTORS: Record<string, { wiring: string }> = {
  B: { wiring: 'YRUHQSLDPXNGOKMIEBFZCWVJAT' },
  C: { wiring: 'FVPJIAOYEDRZXWGCTKUQSBNMHL' },
};

export interface RotorState {
  type: string;
  position: number; // 0-25 (A-Z)
  ringSetting: number; // 0-25 (0 = A)
}

export interface EnigmaConfig {
  rotors: [RotorState, RotorState, RotorState]; // Left, Middle, Right
  reflector: string;
  plugboard: Record<string, string>;
}

// Helper to convert char to index (A=0, B=1...)
export const c2i = (c: string) => c.toUpperCase().charCodeAt(0) - 65;
// Helper to convert index to char
export const i2c = (i: number) => String.fromCharCode(((i % 26 + 26) % 26) + 65);

export class EnigmaMachine {
  private config: EnigmaConfig;

  constructor(config: EnigmaConfig) {
    this.config = JSON.parse(JSON.stringify(config)); // Deep copy
  }

  public getConfig(): EnigmaConfig {
    return this.config;
  }

  public setConfig(config: EnigmaConfig) {
    this.config = JSON.parse(JSON.stringify(config));
  }

  private stepRotors() {
    const { rotors } = this.config;
    const [left, middle, right] = rotors;
    
    const rightNotch = c2i(ROTORS[right.type].notch);
    const middleNotch = c2i(ROTORS[middle.type].notch);

    // Double stepping mechanism
    const rightAtNotch = right.position === rightNotch;
    const middleAtNotch = middle.position === middleNotch;

    // Right rotor always steps
    let rotateRight = true;
    let rotateMiddle = false;
    let rotateLeft = false;

    if (middleAtNotch) {
      rotateMiddle = true;
      rotateLeft = true;
    } else if (rightAtNotch) {
      rotateMiddle = true;
    }

    if (rotateRight) right.position = (right.position + 1) % 26;
    if (rotateMiddle) middle.position = (middle.position + 1) % 26;
    if (rotateLeft) left.position = (left.position + 1) % 26;
  }

  private mapThroughRotor(index: number, rotor: RotorState, inverse: boolean): number {
    const wiring = ROTORS[rotor.type].wiring;
    const offset = rotor.position - rotor.ringSetting;
    
    // Enter rotor
    const inputIndex = (index + offset + 26) % 26;
    
    let outputIndex: number;
    if (!inverse) {
      // Forward pass (Right to Left)
      const charAtContact = i2c(inputIndex);
      const wiredChar = wiring[inputIndex];
      outputIndex = c2i(wiredChar);
    } else {
      // Backward pass (Left to Right)
      const charAtContact = i2c(inputIndex);
      const wiredIndex = wiring.indexOf(charAtContact);
      outputIndex = wiredIndex;
    }

    // Exit rotor
    return (outputIndex - offset + 26) % 26;
  }

  /**
   * Maps an index through the rotors and reflector (Right -> Left -> Reflector -> Left -> Right).
   * Since Enigma is reciprocal, this logic serves for both encryption and decryption.
   */
  public mapThroughRotors(inputIndex: number): number {
    let current = inputIndex;

    // Rotors (Right to Left)
    // Fast rotor (Right) -> Middle -> Slow (Left)
    current = this.mapThroughRotor(current, this.config.rotors[2], false);
    current = this.mapThroughRotor(current, this.config.rotors[1], false);
    current = this.mapThroughRotor(current, this.config.rotors[0], false);

    // Reflector
    const reflectorWiring = REFLECTORS[this.config.reflector].wiring;
    current = c2i(reflectorWiring[current]);

    // Rotors (Left to Right)
    current = this.mapThroughRotor(current, this.config.rotors[0], true);
    current = this.mapThroughRotor(current, this.config.rotors[1], true);
    current = this.mapThroughRotor(current, this.config.rotors[2], true);

    return current;
  }

  public pressKey(char: string): { encryptedChar: string; newConfig: EnigmaConfig } {
    const inputIndex = c2i(char);
    
    // 1. Step Rotors
    this.stepRotors();

    // 2. Plugboard (In)
    let current = inputIndex;
    const plugChar = i2c(current);
    if (this.config.plugboard[plugChar]) {
      current = c2i(this.config.plugboard[plugChar]);
    }

    // 3. Rotors & Reflector
    current = this.mapThroughRotors(current);

    // 4. Plugboard (Out)
    const outPlugChar = i2c(current);
    if (this.config.plugboard[outPlugChar]) {
      current = c2i(this.config.plugboard[outPlugChar]);
    }

    return {
      encryptedChar: i2c(current),
      newConfig: JSON.parse(JSON.stringify(this.config))
    };
  }

  /**
   * Decrypts a character. 
   * Note: Enigma is reciprocal, so decryption is identical to encryption given the same start state.
   * This method is an alias for pressKey.
   */
  public decrypt(char: string): { decryptedChar: string; newConfig: EnigmaConfig } {
    const result = this.pressKey(char);
    return {
      decryptedChar: result.encryptedChar,
      newConfig: result.newConfig
    };
  }
}
