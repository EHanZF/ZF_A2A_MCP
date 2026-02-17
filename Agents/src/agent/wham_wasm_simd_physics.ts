export class WhamSimdPhysics {
  private wasm: any;
  private mem: Float32Array;

  async loadWasm(url: string) {
    const buf = await fetch(url).then(r => r.arrayBuffer());
    const mod = await WebAssembly.instantiate(buf, {});
    this.wasm = mod.instance.exports;
    this.mem = new Float32Array(this.wasm.mem.buffer);
  }

  /** Position and velocity at index 0 in memory */
  setAvatarState(x: number, y: number, z: number,
                 vx: number, vy: number, vz: number) {
    this.mem[0] = x;
    this.mem[1] = y;
    this.mem[2] = z;
    this.mem[3] = vx;
    this.mem[4] = vy;
    this.mem[5] = vz;
  }

  step() {
    this.wasm.step_physics();
    return {
      x: this.mem[0],
      y: this.mem[1],
      z: this.mem[2]
    };
  }
}
