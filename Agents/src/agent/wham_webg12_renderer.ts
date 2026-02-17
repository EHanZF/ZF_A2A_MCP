export class WhamWebGL2Renderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;

  private camPos = [0, 2, 5];
  private target = [0, 0, 0];

  private proj: Float32Array;
  private view: Float32Array;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;

    this.program = this.createProgram(
      this.vertexShader(),
      this.fragmentShader()
    );

    gl.enable(gl.DEPTH_TEST);
    this.proj = this.perspective(45, canvas.width/canvas.height, 0.1, 100);
  }

  setCamera(pos: number[], tgt: number[]) {
    this.camPos = pos;
    this.target = tgt;
  }

  updateView() {
    this.view = this.lookAt(this.camPos, this.target, [0,1,0]);
  }

  renderAvatar(x: number, y: number, z: number) {
    const gl = this.gl;
    gl.clearColor(0.03, 0.03, 0.03, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.updateView();

    gl.useProgram(this.program);

    // uniforms
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.program, "u_proj"),
      false,
      this.proj
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.program, "u_view"),
      false,
      this.view
    );

    // model transform
    const model = this.translate(x, y, z);
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.program, "u_model"),
      false,
      model
    );

    // draw simple cube mesh
    this.drawCube();
  }

  drawCube() {
    const gl = this.gl;

    const verts = new Float32Array([
      -0.3,-0.3,-0.3,   0.3,-0.3,-0.3,   0.3,0.3,-0.3,
      -0.3,0.3,-0.3,   -0.3,-0.3,0.3,   0.3,-0.3,0.3,
      0.3,0.3,0.3,     -0.3,0.3,0.3
    ]);

    const idx = new Uint16Array([
      0,1,2, 2,3,0,
      4,5,6, 6,7,4,
      0,1,5, 5,4,0,
      3,2,6, 6,7,3,
      1,2,6, 6,5,1,
      0,3,7, 7,4,0
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program, "a_pos");
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posLoc);

    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);

    gl.deleteBuffer(vbo);
    gl.deleteBuffer(ibo);
  }

  /** --- Shader Code --- */

  vertexShader() {
    return `
    attribute vec3 a_pos;

    uniform mat4 u_model;
    uniform mat4 u_view;
    uniform mat4 u_proj;

    void main() {
      gl_Position = u_proj * u_view * u_model * vec4(a_pos,1.0);
    }
    `;
  }

  fragmentShader() {
    return `
    precision highp float;

    void main() {
      gl_FragColor = vec4(0.3, 1.0, 0.5, 1.0);
    }
    `;
  }

  /** --- Math utilities (matrices) --- */
  perspective(fovDeg: number, aspect: number, near: number, far: number) {
    const f = 1.0 / Math.tan((fovDeg*Math.PI/180)/2);
    const nf = 1/(near-far);

    return new Float32Array([
      f/aspect,0,0,0,
      0,f,0,0,
      0,0,(far+near)*nf,-1,
      0,0,(2*far*near)*nf,0
    ]);
  }

  lookAt(eye: number[], target: number[], up: number[]) {
    const zx = eye[0]-target[0], zy = eye[1]-target[1], zz = eye[2]-target[2];
    const zmag = Math.hypot(zx,zy,zz);
    const zx2 = zx/zmag, zy2 = zy/zmag, zz2 = zz/zmag;

    const xx = up[1]*zz2 - up[2]*zy2;
    const xy = up[2]*zx2 - up[0]*zz2;
    const xz = up[0]*zy2 - up[1]*zx2;
    const xmag = Math.hypot(xx,xy,xz);
    const xx2 = xx/xmag, xy2 = xy/xmag, xz2 = xz/xmag;

    const yx = zy2*xz2 - zz2*xy2;
    const yy = zz2*xx2 - zx2*xz2;
    const yz = zx2*xy2 - zy2*xx2;

    return new Float32Array([
      xx2, yx, zx2, 0,
      xy2, yy, zy2, 0,
      xz2, yz, zz2, 0,
      -(xx2*eye[0]+xy2*eye[1]+xz2*eye[2]),
      -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
      -(zx2*eye[0]+zy2*eye[1]+zz2*eye[2]),
      1
    ]);
  }

  translate(x: number, y: number, z: number) {
    return new Float32Array([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      x,y,z,1
    ]);
  }

  private createProgram(vs: string, fs: string) {
    const gl = this.gl;
    const vshader = this.compile(vs, gl.VERTEX_SHADER);
    const fshader = this.compile(fs, gl.FRAGMENT_SHADER);
    const prog = gl.createProgram();
    gl.attachShader(prog,vshader);
    gl.attachShader(prog,fshader);
    gl.linkProgram(prog);
    return prog;
  }

  private compile(source: string, type: number) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    return shader;
  }
}
