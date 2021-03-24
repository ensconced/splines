const shape = [
  {
    x: 150,
    y: 100,
  },
  {
    x: 300,
    y: 150,
  },
  {
    x: 400,
    y: 250,
  },
  {
    x: 500,
    y: 350,
  },
  {
    x: 650,
    y: 400,
  },
  {
    x: 600,
    y: 250,
  },
  {
    x: 500,
    y: 150,
  },
  {
    x: 300,
    y: 150,
  },
  {
    x: 200,
    y: 250,
  },
  {
    x: 150,
    y: 400,
  },
  {
    x: 300,
    y: 350,
  },
  {
    x: 400,
    y: 250,
  },
  {
    x: 500,
    y: 150,
  },
  {
    x: 650,
    y: 100,
  },
  {
    x: 600,
    y: 250,
  },
  {
    x: 500,
    y: 350,
  },
  {
    x: 300,
    y: 350,
  },
  {
    x: 200,
    y: 250,
  },
].map((point) => ({ x: point.x * 2, y: point.y * 2 }));

const numSegments = 128;
let buffers;

var circleProgramInfo;
var uniformLocations;

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
var curveEdit = 0;
let canvasSize: Vector;
var showColors = true;
const black = { r: 0, g: 0, b: 0 };
let firstLine = true;
let limits1, center1, axes1, limits2, center2, axes2;

function main() {
  canvas = document.querySelector("#glCanvas") as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("failed to create canvas context");
  ctx = context;
  updateCanvasSize();
  drawCircleCurves();
  drawPoints();
}

function updateCanvasSize() {
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = pixelRatio * canvas.clientWidth;
  canvas.height = pixelRatio * canvas.clientHeight;
  const width = canvas.width / devicePixelRatio;
  const height = canvas.height / devicePixelRatio;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  canvasSize = [width, height];
}

interface Point {
  x: number;
  y: number;
}

function vadd(v0: Point, v1: Point): Point {
  return { x: v0.x + v1.x, y: v0.y + v1.y };
}
function vsub(v0: Point, v1: Point): Point {
  return { x: v0.x - v1.x, y: v0.y - v1.y };
}
function vmult(f: number, v: Point): Point {
  return { x: f * v.x, y: f * v.y };
}
function vdiv(v: Point, f: number): Point {
  return { x: v.x / f, y: v.y / f };
}
function vdot(v0: Point, v1: Point): number {
  return v0.x * v1.x + v0.y * v1.y;
}
function determinant(v0: Point, v1: Point): number {
  return v0.x * v1.y - v0.y * v1.x;
}

function rotate90(vec: Point): Point {
  return { x: -vec.y, y: vec.x };
}

function getCircle(i: number) {
  // The perpendicular bisectors of two chords of a circle meet at the centre.
  // j, i and k are three points defining a circle.
  // our chords will be j-i and i-k
  var j = (i - 1 + shape.length) % shape.length;
  var k = (i + 1) % shape.length;
  var vec1 = vsub(shape[i], shape[j]);
  var mid1 = vadd(shape[j], vdiv(vec1, 2));
  var dir1 = rotate90(vec1);
  var vec2 = vsub(shape[k], shape[i]);
  var mid2 = vadd(shape[i], vdiv(vec2, 2));
  var dir2 = rotate90(vec2);
  var det = determinant(dir1, dir2);
  if (Math.abs(det) < 0.001) {
    if (vec1.x * vec2.x + vec1.y * vec2.y >= 0 || shape.length <= 2) {
      const smallAngle = 0.01;
      const s = Math.sin(smallAngle);
      const l1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
      const l2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
      return {
        center: shape[i],
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
  var axis1 = vsub(shape[i], center);
  var axis2 = { x: -axis1.y, y: axis1.x };
  var toPt2 = vsub(shape[k], center);
  var limit2 = Math.atan2(vdot(axis2, toPt2), vdot(axis1, toPt2));
  var toPt1 = vsub(shape[j], center);
  var limit1 = Math.atan2(vdot(axis2, toPt1), vdot(axis1, toPt1));
  if (limit1 * limit2 > 0) {
    if (Math.abs(limit1) < Math.abs(limit2))
      limit2 += limit2 > 0 ? -2 * Math.PI : 2 * Math.PI;
    if (Math.abs(limit1) > Math.abs(limit2))
      limit1 += limit1 > 0 ? -2 * Math.PI : 2 * Math.PI;
  }
  return {
    center: center,
    axis1,
    axis2,
    limits: [limit1, 0, limit2],
    color: showColors ? { r: 1, g: 0, b: 0 } : black,
  };
}

function getEllipse(index: number) {
  const numIter = 16;
  var j = (index - 1 + shape.length) % shape.length;
  var k = (index + 1) % shape.length;
  var vec1 = vsub(shape[j], shape[index]);
  var vec2 = vsub(shape[k], shape[index]);

  if (shape.length <= 2) {
    const smallAngle = 0.01;
    const s = Math.sin(smallAngle);
    return {
      center: shape[index],
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
    pt2 = shape[k];
  } else {
    vec = vec1;
    len = len1;
    pt2 = shape[j];
  }
  var dir = vdiv(vec, len);
  var perp = { x: -dir.y, y: dir.x };
  var cross = determinant(vec1, vec2);
  if ((len1 < len2 && cross > 0) || (len1 >= len2 && cross < 0))
    perp = { x: dir.y, y: -dir.x };
  var v = (b * b) / len;
  var h = (b * a) / len;
  var axis1 = vsub(vmult(-v, dir), vmult(h, perp));
  var center = vsub(shape[index], axis1);
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

function drawCircleCurves() {
  ctx.beginPath();
  if (shape.length < 2) return;
  const c1 = getInterpolationCurve(0);
  limits1 = [c1.limits[1], c1.limits[2]];
  center1 = [c1.center.x, c1.center.y];
  axes1 = [c1.axis1.x, c1.axis1.y, c1.axis2.x, c1.axis2.y];
  const curveStart = 1;

  for (var i = curveStart; i < shape.length; i++) {
    var c2 = getInterpolationCurve(i);
    limits2 = [c2.limits[0], c2.limits[1]];
    center2 = [c2.center.x, c2.center.y];
    axes2 = [c2.axis1.x, c2.axis1.y, c2.axis2.x, c2.axis2.y];
    for (let i = 0; i <= numSegments; i++) {
      draw(i / numSegments, limits1, center1, axes1, limits2, center2, axes2);
    }
    limits1 = [c2.limits[1], c2.limits[2]];
    center1 = [c2.center.x, c2.center.y];
    axes1 = [c2.axis1.x, c2.axis1.y, c2.axis2.x, c2.axis2.y];
  }
  {
    const c2 = getInterpolationCurve(shape.length - 1);
    limits2 = [c2.limits[0], c2.limits[1]];
    center2 = [c2.center.x, c2.center.y];
    axes2 = [c2.axis1.x, c2.axis1.y, c2.axis2.x, c2.axis2.y];
    {
      limits1 = [c2.limits[1], c2.limits[2]] as Vector;
      center1 = [c2.center.x, c2.center.y] as Vector;
      axes1 = [c2.axis1.x, c2.axis1.y, c2.axis2.x, c2.axis2.y] as Quad;
      const c3 = getInterpolationCurve(0);
      limits2 = [c3.limits[0], c3.limits[1]] as Vector;
      center2 = [c3.center.x, c3.center.y] as Vector;
      axes2 = [c3.axis1.x, c3.axis1.y, c3.axis2.x, c3.axis2.y] as Quad;
      for (let i = 0; i <= numSegments; i++) {
        draw(i / numSegments, limits1, center1, axes1, limits2, center2, axes2);
      }
    }
  }
  ctx.lineWidth = 2;
  ctx.stroke();
}

type Vector = [number, number];
type Color = [number, number, number];
type Quad = [number, number, number, number];

function addVectors(v1: Vector, v2: Vector): Vector {
  return v1.map((x, idx) => x + v2[idx]) as Vector;
}

function multiplyComponents(v1: Vector, v2: Vector): Vector {
  return v1.map((x, idx) => x * v2[idx]) as Vector;
}

function divideComponents(v1: Vector, v2: Vector): Vector {
  return v1.map((x, idx) => x / v2[idx]) as Vector;
}

function scaleVector(v: Vector, scalar: number): Vector {
  return v.map((x) => x * scalar) as Vector;
}

function curvePos(
  t: number,
  limits: Vector,
  axes: Quad,
  center: Vector
): Vector {
  const tt = limits[0] + t * (limits[1] - limits[0]);
  return addVectors(
    center,
    addVectors(
      scaleVector(axes.slice(0, 2) as Vector, Math.cos(tt)),
      scaleVector(axes.slice(2, 4) as Vector, Math.sin(tt))
    )
  );
}

function draw(
  t: number,
  limits1: Vector,
  center1: Vector,
  axes1: Quad,
  limits2: Vector,
  center2: Vector,
  axes2: Quad
) {
  const p1 = curvePos(t, limits1, axes1, center1);
  const p2 = curvePos(t, limits2, axes2, center2);
  const cs = [
    Math.cos((Math.PI / 2) * t),
    Math.sin((Math.PI / 2) * t),
  ] as Vector;
  const cs2 = multiplyComponents(cs, cs);
  const p = addVectors(
    p1.map((x) => x * cs2[0]) as Vector,
    p2.map((x) => x * cs2[1]) as Vector
  );
  if (firstLine) {
    ctx.moveTo(...p);
    firstLine = false;
  } else {
    ctx.lineTo(...p);
  }
}

function drawPoints() {
  shape.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
    ctx.fill();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  main();
});
