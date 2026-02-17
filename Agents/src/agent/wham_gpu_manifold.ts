export class WhamGpuManifoldViz {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private instanceVBO: WebGLBuffer;

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext("webgl2");
    if (!this.gl) throw new Error("WebGL2 required");

    this.program = this.createProgram(
      this.vertexShader(),
      this.fragmentShader()
    );

    this.instanceVBO = this.gl.createBuffer();
  }

  loadVectors(vectors: number[][]) {
    const flat = new Float32Array(vectors.length * 3);
    for (let i = 0; i < vectors.length; i++) {
      flat[i*3+0] = vectors[i][0];
      flat[i*3+1] = vectors[i][1];
      flat[i*3+2] = vectors[i][2];
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceVBO);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, flat, this.gl.STATIC_DRAW);
  }

  render() {
    const gl = this.gl;

    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);

    const posLoc = gl.getAttribLocation(this.program, "a_offset");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(posLoc, 1);

    // single dummy triangle per instance
    const tri = new Float32Array([0,0,0]);
    const triBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
    gl.bufferData(gl.ARRAY_BUFFER, tri, gl.STATIC_DRAW);

    const vertLoc = gl.getAttribLocation(this.program, "a_vert");
    gl.enableVertexAttribArray(vertLoc);
    gl.vertexAttribPointer(vertLoc, 3, gl.FLOAT, false, 0, 0);

    gl.drawArraysInstanced(gl.POINTS, 0, 1, this.count);

    gl.deleteBuffer(triBuf);
  }

  get count() {
    return this.gl.getBufferParameter(this.gl.ARRAY_BUFFER, this.gl.BUFFER_SIZE) / (Float32Array.BYTES_PER_ELEMENT * 3);
  }

  vertexShader() {
    return `
      attribute vec3 a_vert;
      attribute vec3 a_offset;
      void main() {
        gl_Position = vec4(a_offset,1.0);
        gl_PointSize = 5.0;
      }
    `;
  }

  fragmentShader() {
    return `
      precision highp float;
      void main() {
        gl_FragColor = vec4(0.2,0.8,1.0,1.0);
      }
    `;
  }

  private createProgram(vs: string, fs: string) {
    const gl = this.gl;
    const vsObj = this.compile(vs, gl.VERTEX_SHADER);
    const fsObj = this.compile(fs, gl.FRAGMENT_SHADER);
    const prog = gl.createProgram();
    gl.attachShader(prog, vsObj);
    gl.attachShader(prog, fsObj);
    gl.linkProgram(prog);
    return prog;
  }

  private compile(src: string, type: number) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
  }
}
