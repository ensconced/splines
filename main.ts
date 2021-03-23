enum ShowEnds {
  hideEnds,
  showEnds,
  joinEnds,
}

const shape = {
  points: [
    {
      x: 100,
      y: 100,
    },
    {
      x: 200,
      y: 200,
    },
    {
      x: 600,
      y: 300,
    },
    {
      x: 764.8,
      y: 800,
    },
    {
      x: 864.8,
      y: 800,
    },
    {
      x: 964,
      y: 400,
    },
  ],
  showEnds: ShowEnds.joinEnds,
} as const;

const numSegments = 20;
let buffers;

var circleProgramInfo;

let gl;
var curveEdit = 0;

var showColors = true;
const black = { r: 0, g: 0, b: 0 };

function main() {
  // set up canvas and context
  const canvas = document.querySelector("#glCanvas") as HTMLCanvasElement;
  gl = canvas.getContext("webgl", { antialias: false, depth: false });
  if (!gl) throw new Error("failed to create webgl context");
  gl.clearColor(1.0, 1.0, 1.0, 0.0);
  gl.lineWidth(1.0);

  const circleProgram = initShaderProgram(vertexShaderCircle, fragmentShader);
  circleProgramInfo = {
    program: circleProgram,
    attribLocations: {
      t: gl.getAttribLocation(circleProgram, "t"),
    },
    uniformLocations: {
      limits1: gl.getUniformLocation(circleProgram, "curve1.limits"),
      center1: gl.getUniformLocation(circleProgram, "curve1.center"),
      axes1: gl.getUniformLocation(circleProgram, "curve1.axes"),
      limits2: gl.getUniformLocation(circleProgram, "curve2.limits"),
      center2: gl.getUniformLocation(circleProgram, "curve2.center"),
      axes2: gl.getUniformLocation(circleProgram, "curve2.axes"),
      color: gl.getUniformLocation(circleProgram, "color"),
      color1: gl.getUniformLocation(circleProgram, "color1"),
      color2: gl.getUniformLocation(circleProgram, "color2"),
      size: gl.getUniformLocation(circleProgram, "canvasSize"),
    },
  };

  updateCanvasSize();
  initBuffers();
  drawScene();
}

function updateCanvasSize() {
  const canvas = document.querySelector("#glCanvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = pixelRatio * canvas.clientWidth;
  canvas.height = pixelRatio * canvas.clientHeight;
  const width = canvas.width / devicePixelRatio;
  const height = canvas.height / devicePixelRatio;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  gl.viewport(0, 0, canvas.width, canvas.height);

  const progs = [circleProgramInfo];

  progs.forEach(function (p) {
    gl.useProgram(p.program);
    gl.uniform2f(p.uniformLocations.size, width, height);
  });
}

function initShaderProgram(vsSource, fsSource) {
  const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(shaderProgram)
    );
    return null;
  }
  return shaderProgram;
}

function loadShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function initBuffers() {
  var segpos = [];
  for (var i = 0; i <= numSegments; i++) {
    segpos[i] = i / numSegments;
  }
  const segposBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, segposBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(segpos), gl.STATIC_DRAW);
  buffers = {
    segpos: segposBuffer,
  };
}

function vadd(v0, v1) {
  return { x: v0.x + v1.x, y: v0.y + v1.y };
}
function vsub(v0, v1) {
  return { x: v0.x - v1.x, y: v0.y - v1.y };
}
function vmult(f, v) {
  return { x: f * v.x, y: f * v.y };
}
function vdiv(v, f) {
  return { x: v.x / f, y: v.y / f };
}
function vdot(v0, v1) {
  return v0.x * v1.x + v0.y * v1.y;
}
function vcross(v0, v1) {
  return v0.x * v1.y - v0.y * v1.x;
}

function getCircle(index: number) {
  var j = (index - 1 + shape.points.length) % shape.points.length;
  var k = (index + 1) % shape.points.length;
  var vec1 = vsub(shape.points[index], shape.points[j]);
  var mid1 = vadd(shape.points[j], vdiv(vec1, 2));
  var dir1 = { x: -vec1.y, y: vec1.x };
  var vec2 = vsub(shape.points[k], shape.points[index]);
  var mid2 = vadd(shape.points[index], vdiv(vec2, 2));
  var dir2 = { x: -vec2.y, y: vec2.x };
  var det = vcross(dir1, dir2);
  if (Math.abs(det) < 0.001) {
    if (vec1.x * vec2.x + vec1.y * vec2.y >= 0 || shape.points.length <= 2) {
      const smallAngle = 0.01;
      const s = Math.sin(smallAngle);
      const l1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const l2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
      return {
        center: shape.points[index],
        axis1: { x: 0, y: 0 },
        axis2: vdiv(vec2, s),
        limits: [(-smallAngle * l1) / l2, 0, smallAngle],
        color: showColors ? { r: 1, g: 0, b: 0 } : black,
      };
    } else {
      det = 0.001;
    }
  }
  var s = (dir2.y * (mid2.x - mid1.x) + dir2.x * (mid1.y - mid2.y)) / det;
  var center = vadd(mid1, vmult(s, dir1));
  var axis1 = vsub(shape.points[index], center);
  var axis2 = { x: -axis1.y, y: axis1.x };
  var toPt2 = vsub(shape.points[k], center);
  var limit2 = Math.atan2(vdot(axis2, toPt2), vdot(axis1, toPt2));
  var toPt1 = vsub(shape.points[j], center);
  var limit1 = Math.atan2(vdot(axis2, toPt1), vdot(axis1, toPt1));
  if (limit1 * limit2 > 0) {
    if (Math.abs(limit1) < Math.abs(limit2))
      limit2 += limit2 > 0 ? -2 * Math.PI : 2 * Math.PI;
    if (Math.abs(limit1) > Math.abs(limit2))
      limit1 += limit1 > 0 ? -2 * Math.PI : 2 * Math.PI;
  }
  return {
    center: center,
    axis1: axis1,
    axis2: axis2,
    limits: [limit1, 0, limit2],
    color: showColors ? { r: 1, g: 0, b: 0 } : black,
  };
}

function getEllipse(index: number) {
  const numIter = 16;
  var j = (index - 1 + shape.points.length) % shape.points.length;
  var k = (index + 1) % shape.points.length;
  var vec1 = vsub(shape.points[j], shape.points[index]);
  var vec2 = vsub(shape.points[k], shape.points[index]);

  if (shape.points.length <= 2) {
    const smallAngle = 0.01;
    const s = Math.sin(smallAngle);
    return {
      center: shape.points[index],
      axis1: { x: 0, y: 0 },
      axis2: vdiv(vec2, s),
      limits: [-smallAngle, 0, smallAngle],
      color: showColors ? { r: 0, g: 0, b: 1 } : black,
    };
  }

  var len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
  var len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
  var cosa = (vec1.x * vec2.x + vec1.y * vec2.y) / (len1 * len2);
  var maxA = Math.acos(cosa);
  var ang = maxA * 0.5;
  var incA = maxA * 0.25;
  var l1 = len1;
  var l2 = len2;
  if (len1 < len2) {
    l1 = len2;
    l2 = len1;
  }
  var a, b, c, d;
  for (var iter = 0; iter < numIter; iter++) {
    var theta = ang * 0.5;
    a = l1 * Math.sin(theta);
    b = l1 * Math.cos(theta);
    var beta = maxA - theta;
    c = l2 * Math.sin(beta);
    d = l2 * Math.cos(beta);
    var v = (1 - d / b) * (1 - d / b) + (c * c) / (a * a); // ellipse equation
    ang += v > 1 ? incA : -incA;
    incA *= 0.5;
  }
  var vec, len, pt2;
  if (len1 < len2) {
    vec = vec2;
    len = len2;
    pt2 = shape.points[k];
  } else {
    vec = vec1;
    len = len1;
    pt2 = shape.points[j];
  }
  var dir = vdiv(vec, len);
  var perp = { x: -dir.y, y: dir.x };
  var cross = vcross(vec1, vec2);
  if ((len1 < len2 && cross > 0) || (len1 >= len2 && cross < 0))
    perp = { x: dir.y, y: -dir.x };
  var v = (b * b) / len;
  var h = (b * a) / len;
  var axis1 = vsub(vmult(-v, dir), vmult(h, perp));
  var center = vsub(shape.points[index], axis1);
  var axis2 = vsub(pt2, center);
  var beta = Math.asin(Math.min(c / a, 1));
  return {
    center: center,
    axis1: axis1,
    axis2: len1 < len2 ? axis2 : { x: -axis2.x, y: -axis2.y },
    limits: len1 < len2 ? [-beta, 0, Math.PI * 0.5] : [-Math.PI * 0.5, 0, beta],
    color: showColors ? { r: 0, g: 0, b: 1 } : black,
  };
}

function getInterpolationCurve(index: number) {
  let c = getCircle(index);
  let lim0 = c.limits[0];
  let lim2 = c.limits[2];
  if (lim2 < lim0) {
    const l = lim0;
    lim0 = lim2;
    lim2 = l;
  }
  if (lim0 < -Math.PI * 0.5 || lim2 > Math.PI * 0.5) {
    c = getEllipse(index);
  }
  return c;
}

async function drawCircleCurves(prg) {
  if (shape.points.length < 2) return;
  var c1 = getInterpolationCurve(shape.showEnds == ShowEnds.joinEnds ? 0 : 1);
  gl.uniform2f(
    circleProgramInfo.uniformLocations.limits1,
    c1.limits[shape.showEnds == 1 ? 0 : 1],
    c1.limits[shape.showEnds == 1 ? 1 : 2]
  );
  gl.uniform2f(
    circleProgramInfo.uniformLocations.center1,
    c1.center.x,
    c1.center.y
  );
  gl.uniform4f(
    circleProgramInfo.uniformLocations.axes1,
    c1.axis1.x,
    c1.axis1.y,
    c1.axis2.x,
    c1.axis2.y
  );
  if (circleProgramInfo.uniformLocations.color1)
    gl.uniform3f(
      circleProgramInfo.uniformLocations.color1,
      c1.color.r,
      c1.color.g,
      c1.color.b
    );
  if (shape.points.length <= 2 && shape.showEnds != ShowEnds.hideEnds) {
    gl.uniform2f(
      circleProgramInfo.uniformLocations.limits1,
      c1.limits[1],
      c1.limits[2]
    );
    gl.uniform2f(
      circleProgramInfo.uniformLocations.limits2,
      c1.limits[1],
      c1.limits[2]
    );
    gl.uniform2f(
      circleProgramInfo.uniformLocations.center2,
      c1.center.x,
      c1.center.y
    );
    gl.uniform4f(
      circleProgramInfo.uniformLocations.axes2,
      c1.axis1.x,
      c1.axis1.y,
      c1.axis2.x,
      c1.axis2.y
    );
    if (circleProgramInfo.uniformLocations.color2)
      gl.uniform3f(
        circleProgramInfo.uniformLocations.color2,
        c1.color.r,
        c1.color.g,
        c1.color.b
      );
    gl.drawArrays(gl.LINE_STRIP, 0, prg.numVerts);
    return;
  }
  const curveStart = shape.showEnds == ShowEnds.hideEnds ? 2 : 1;

  for (var i = curveStart; i < shape.points.length - 1; i++) {
    var c2 = getInterpolationCurve(i, shape);
    gl.uniform2f(
      circleProgramInfo.uniformLocations.limits2,
      c2.limits[0],
      c2.limits[1]
    );
    gl.uniform2f(
      circleProgramInfo.uniformLocations.center2,
      c2.center.x,
      c2.center.y
    );
    gl.uniform4f(
      circleProgramInfo.uniformLocations.axes2,
      c2.axis1.x,
      c2.axis1.y,
      c2.axis2.x,
      c2.axis2.y
    );
    if (circleProgramInfo.uniformLocations.color2)
      gl.uniform3f(
        circleProgramInfo.uniformLocations.color2,
        c2.color.r,
        c2.color.g,
        c2.color.b
      );

    gl.drawArrays(gl.LINE_STRIP, 0, prg.numVerts);
    gl.uniform2f(
      circleProgramInfo.uniformLocations.limits1,
      c2.limits[1],
      c2.limits[2]
    );
    gl.uniform2f(
      circleProgramInfo.uniformLocations.center1,
      c2.center.x,
      c2.center.y
    );
    gl.uniform4f(
      circleProgramInfo.uniformLocations.axes1,
      c2.axis1.x,
      c2.axis1.y,
      c2.axis2.x,
      c2.axis2.y
    );
    if (circleProgramInfo.uniformLocations.color1)
      gl.uniform3f(
        circleProgramInfo.uniformLocations.color1,
        c2.color.r,
        c2.color.g,
        c2.color.b
      );
  }
  if (shape.showEnds != ShowEnds.hideEnds) {
    var c2 = getInterpolationCurve(
      shape.points.length - (shape.showEnds == ShowEnds.joinEnds ? 1 : 2),
      shape
    );
    gl.uniform2f(
      circleProgramInfo.uniformLocations.limits2,
      c2.limits[2 - shape.showEnds],
      c2.limits[3 - shape.showEnds]
    );
    gl.uniform2f(
      circleProgramInfo.uniformLocations.center2,
      c2.center.x,
      c2.center.y
    );
    gl.uniform4f(
      circleProgramInfo.uniformLocations.axes2,
      c2.axis1.x,
      c2.axis1.y,
      c2.axis2.x,
      c2.axis2.y
    );
    if (circleProgramInfo.uniformLocations.color2)
      gl.uniform3f(
        circleProgramInfo.uniformLocations.color2,
        c2.color.r,
        c2.color.g,
        c2.color.b
      );
    gl.drawArrays(gl.LINE_STRIP, 0, prg.numVerts);
    if (shape.showEnds == ShowEnds.joinEnds) {
      gl.uniform2f(
        circleProgramInfo.uniformLocations.limits1,
        c2.limits[1],
        c2.limits[2]
      );
      gl.uniform2f(
        circleProgramInfo.uniformLocations.center1,
        c2.center.x,
        c2.center.y
      );
      gl.uniform4f(
        circleProgramInfo.uniformLocations.axes1,
        c2.axis1.x,
        c2.axis1.y,
        c2.axis2.x,
        c2.axis2.y
      );
      if (circleProgramInfo.uniformLocations.color1)
        gl.uniform3f(
          circleProgramInfo.uniformLocations.color1,
          c2.color.r,
          c2.color.g,
          c2.color.b
        );
      var c3 = getInterpolationCurve(0, shape);
      gl.uniform2f(
        circleProgramInfo.uniformLocations.limits2,
        c3.limits[0],
        c3.limits[1]
      );
      gl.uniform2f(
        circleProgramInfo.uniformLocations.center2,
        c3.center.x,
        c3.center.y
      );
      gl.uniform4f(
        circleProgramInfo.uniformLocations.axes2,
        c3.axis1.x,
        c3.axis1.y,
        c3.axis2.x,
        c3.axis2.y
      );
      if (circleProgramInfo.uniformLocations.color2)
        gl.uniform3f(
          circleProgramInfo.uniformLocations.color2,
          c3.color.r,
          c3.color.g,
          c3.color.b
        );
      gl.drawArrays(gl.LINE_STRIP, 0, prg.numVerts);
    }
  }
}

function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(circleProgramInfo.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.segpos);
  gl.vertexAttribPointer(
    circleProgramInfo.attribLocations.t,
    1,
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(circleProgramInfo.attribLocations.t);
  gl.uniform3f(
    circleProgramInfo.uniformLocations.color1,
    0,
    showColors ? 0.5 : 0,
    0
  );
  gl.uniform3f(
    circleProgramInfo.uniformLocations.color2,
    0,
    showColors ? 0.5 : 0,
    0
  );
  drawCircleCurves(
    {
      numVerts: numSegments + 1,
    },
    shape
  );
}

const vertexShaderCircle = `
	struct CurveData {
		vec2 limits;
		vec2 center;
		vec4 axes;
	};
	vec2 curvePos( CurveData curve, float t )
	{
		float tt = curve.limits.x + t * (curve.limits.y - curve.limits.x);
		return curve.center + curve.axes.xy * cos(tt) + curve.axes.zw * sin(tt);
	}
	attribute float t;
	uniform CurveData curve1, curve2;
	uniform vec2 canvasSize;
	uniform vec3 color1;
	uniform vec3 color2;
	varying vec3 clr;
	void main() {
		vec2  p1  = curvePos(curve1,t);
		vec2  p2  = curvePos(curve2,t);

		const float PI_2 = 1.57079632679489661923;
		vec2  cs  = vec2( cos(PI_2*t), sin(PI_2*t) );
		vec2  cs2 = cs*cs;
		vec2  p   = cs2.x * p1 + cs2.y * p2;

		vec2 cp = p / canvasSize * vec2(2,-2) + vec2(-1,1);
		gl_Position = vec4(cp,0,1);
		clr = cs2.x * color1 + cs2.y * color2;
	}
`;

const fragmentShader = `
	precision mediump float;
	varying vec3 clr;
	void main() {
		gl_FragColor = vec4(clr, 1);
	}
`;

document.addEventListener("DOMContentLoaded", () => {
  main();
});
