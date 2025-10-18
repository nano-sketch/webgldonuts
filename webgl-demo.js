main();

function main() {
  const cvs = document.querySelector("#gl-canvas");
  const gl = cvs.getContext("webgl");
  //vertex shader
  const vs = `
    attribute vec4 aVertexPosition;
    attribute vec3 aVertexNormal;
    uniform mat4 uModelViewMatrix, uProjectionMatrix, uNormalMatrix;
    varying vec3 vNormal, vPosition;
    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vNormal = (uNormalMatrix * vec4(aVertexNormal, 1.0)).xyz;
      vPosition = (uModelViewMatrix * aVertexPosition).xyz;
    }
  `;
  //fragment shader
  const fs = `
    precision mediump float;
    varying vec3 vNormal, vPosition;
    uniform vec3 uLightPosition, uDonutColor;
    void main(void) {
      vec3 n = normalize(vNormal);
      vec3 l = normalize(uLightPosition - vPosition);
      float amb = 0.3;
      float dif = max(dot(n, l), 0.0);
      vec3 v = normalize(-vPosition);
      vec3 r = reflect(-l, n);
      float spec = pow(max(dot(v, r), 0.0), 32.0);
      vec3 res = (amb + dif * 0.7 + spec * 0.5) * uDonutColor;
      gl_FragColor = vec4(res, 1.0);
    }
  `;
  const prog = initShaderProgram(gl, vs, fs);
  const info = {
    program: prog,
    attribLocations: {
      pos: gl.getAttribLocation(prog, "aVertexPosition"),
      nor: gl.getAttribLocation(prog, "aVertexNormal"),
    },
    uniformLocations: {
      proj: gl.getUniformLocation(prog, "uProjectionMatrix"),
      mv: gl.getUniformLocation(prog, "uModelViewMatrix"),
      norm: gl.getUniformLocation(prog, "uNormalMatrix"),
      light: gl.getUniformLocation(prog, "uLightPosition"),
      color: gl.getUniformLocation(prog, "uDonutColor"),
    },
  };
  const bufs = initBuffers(gl);
  let rot = 0;
  function render() {
    rot += 0.01; drawScene(gl, info, bufs, rot); requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

function initBuffers(gl) {
  //torus geometry params
  const r1 = 1.0, r2 = 0.4, seg1 = 48, seg2 = 24;
  let pos = [], nor = [], idx = [];
  for (let i = 0; i <= seg1; i++) {
    let u = (i / seg1) * Math.PI * 2, cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= seg2; j++) {
      let v = (j / seg2) * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
      let x = (r1 + r2 * cv) * cu, y = r2 * sv, z = (r1 + r2 * cv) * su;
      pos.push(x, y, z);
      nor.push(cv * cu, sv, cv * su);
    }
  }
  for (let i = 0; i < seg1; i++) for (let j = 0; j < seg2; j++) {
    let a = i * (seg2 + 1) + j, b = a + seg2 + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  let pb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
  let nb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, nb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nor), gl.STATIC_DRAW);
  let ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  return { position: pb, normal: nb, indices: ib, vertexCount: idx.length };
}

function drawScene(gl, info, bufs, rot) {
  gl.clearColor(0.1, 0.1, 0.15, 1.0); gl.clearDepth(1.0);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const fov = (45 * Math.PI) / 180, asp = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const proj = mat4.create();
  mat4.perspective(proj, fov, asp, 0.1, 100.0);
  //setup model view
  const mv = mat4.create();
  mat4.translate(mv, mv, [0, 0, -5]);
  mat4.rotate(mv, mv, rot, [1, 0.5, 0]);
  const norm = mat4.create();
  mat4.invert(norm, mv); mat4.transpose(norm, norm);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufs.position);
  gl.vertexAttribPointer(info.attribLocations.pos, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(info.attribLocations.pos);
  gl.bindBuffer(gl.ARRAY_BUFFER, bufs.normal);
  gl.vertexAttribPointer(info.attribLocations.nor, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(info.attribLocations.nor);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.indices);
  gl.useProgram(info.program);
  gl.uniformMatrix4fv(info.uniformLocations.proj, false, proj);
  gl.uniformMatrix4fv(info.uniformLocations.mv, false, mv);
  gl.uniformMatrix4fv(info.uniformLocations.norm, false, norm);
  gl.uniform3fv(info.uniformLocations.light, [5, 5, 5]);
  gl.uniform3fv(info.uniformLocations.color, [1, 0.6, 0.8]);
  gl.drawElements(gl.TRIANGLES, bufs.vertexCount, gl.UNSIGNED_SHORT, 0);
}

function initShaderProgram(gl, vs, fs) {
  const vsh = loadShader(gl, gl.VERTEX_SHADER, vs);
  const fsh = loadShader(gl, gl.FRAGMENT_SHADER, fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  return prog;
}

function loadShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

//matrix math utils
const mat4 = {
  create() {
    const o = new Float32Array(16);
    o[0] = 1; o[5] = 1; o[10] = 1; o[15] = 1; return o;
  },
  perspective(o, fovy, asp, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    o[0] = f / asp; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[11] = -1; o[12] = 0; o[13] = 0; o[15] = 0;
    if (far != null && far !== Infinity) {
      const nf = 1 / (near - far);
      o[10] = (far + near) * nf; o[14] = 2 * far * near * nf;
    } else { o[10] = -1; o[14] = -2 * near; }
    return o;
  },
  translate(o, a, v) {
    const x = v[0], y = v[1], z = v[2];
    o[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    o[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    o[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    o[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    return o;
  },
  rotate(o, a, rad, axis) {
    let x = axis[0], y = axis[1], z = axis[2];
    let len = Math.sqrt(x * x + y * y + z * z);
    x /= len; y /= len; z /= len;
    const s = Math.sin(rad), c = Math.cos(rad), t = 1 - c;
    const b00 = x * x * t + c, b01 = y * x * t + z * s, b02 = z * x * t - y * s;
    const b10 = x * y * t - z * s, b11 = y * y * t + c, b12 = z * y * t + x * s;
    const b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c;
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    o[0] = a00 * b00 + a10 * b01 + a20 * b02;
    o[1] = a01 * b00 + a11 * b01 + a21 * b02;
    o[2] = a02 * b00 + a12 * b01 + a22 * b02;
    o[3] = a03 * b00 + a13 * b01 + a23 * b02;
    o[4] = a00 * b10 + a10 * b11 + a20 * b12;
    o[5] = a01 * b10 + a11 * b11 + a21 * b12;
    o[6] = a02 * b10 + a12 * b11 + a22 * b12;
    o[7] = a03 * b10 + a13 * b11 + a23 * b12;
    o[8] = a00 * b20 + a10 * b21 + a20 * b22;
    o[9] = a01 * b20 + a11 * b21 + a21 * b22;
    o[10] = a02 * b20 + a12 * b21 + a22 * b22;
    o[11] = a03 * b20 + a13 * b21 + a23 * b22;
    if (a !== o) { o[12] = a[12]; o[13] = a[13]; o[14] = a[14]; o[15] = a[15]; }
    return o;
  },
  invert(o, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null; det = 1.0 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  transpose(o, a) {
    if (o === a) {
      const a01 = a[1], a02 = a[2], a03 = a[3];
      const a12 = a[6], a13 = a[7];
      const a23 = a[11];
      o[1] = a[4]; o[2] = a[8]; o[3] = a[12]; o[4] = a01; o[6] = a[9]; o[7] = a[13];
      o[8] = a02; o[9] = a12; o[11] = a[14]; o[12] = a03; o[13] = a13; o[14] = a23;
    } else {
      o[0] = a[0]; o[1] = a[4]; o[2] = a[8]; o[3] = a[12];
      o[4] = a[1]; o[5] = a[5]; o[6] = a[9]; o[7] = a[13];
      o[8] = a[2]; o[9] = a[6]; o[10] = a[10]; o[11] = a[14];
      o[12] = a[3]; o[13] = a[7]; o[14] = a[11]; o[15] = a[15];
    }
    return o;
  }
};