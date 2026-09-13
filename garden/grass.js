import * as THREE from 'three';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function spatialVariation(x, z) {
  const broad = Math.sin(x * 0.083 + 1.7) * Math.cos(z * 0.071 - 0.4);
  const fine = Math.sin(x * 0.19 - z * 0.13 + 2.2);
  return THREE.MathUtils.clamp(0.5 + broad * 0.28 + fine * 0.12, 0, 1);
}

function createGroundGeometry(width, depth) {
  const segmentsX = THREE.MathUtils.clamp(Math.round(width / 2), 12, 64);
  const segmentsZ = THREE.MathUtils.clamp(Math.round(depth / 2), 12, 64);
  const vertexCount = (segmentsX + 1) * (segmentsZ + 1);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices = [];
  const base = new THREE.Color('#668954');
  const pale = new THREE.Color('#88a66a');
  const dark = new THREE.Color('#4f7445');
  const color = new THREE.Color();

  let cursor = 0;
  for (let iz = 0; iz <= segmentsZ; iz += 1) {
    const z = (iz / segmentsZ - 0.5) * depth;
    for (let ix = 0; ix <= segmentsX; ix += 1) {
      const x = (ix / segmentsX - 0.5) * width;
      positions[cursor * 3] = x;
      positions[cursor * 3 + 1] = 0;
      positions[cursor * 3 + 2] = z;

      const variation = spatialVariation(x, z);
      color.copy(base).lerp(variation > 0.5 ? pale : dark, Math.abs(variation - 0.5) * 0.72);
      colors[cursor * 3] = color.r;
      colors[cursor * 3 + 1] = color.g;
      colors[cursor * 3 + 2] = color.b;
      cursor += 1;
    }
  }

  for (let iz = 0; iz < segmentsZ; iz += 1) {
    for (let ix = 0; ix < segmentsX; ix += 1) {
      const a = iz * (segmentsX + 1) + ix;
      const b = a + 1;
      const c = a + segmentsX + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.triangleCount = segmentsX * segmentsZ * 2;
  return geometry;
}

function createGrassClusterGeometry() {
  const vertices = [];
  const colors = [];
  // Vertex colors are a lightness gradient; instance colors provide the actual green tint.
  const low = new THREE.Color('#c3d0ba');
  const high = new THREE.Color('#ffffff');

  const blades = [
    [-0.030, 0.015, 1.00, 0.010, 0.000],
    [0.022, -0.018, 0.82, -0.016, 1.23],
    [-0.015, -0.024, 0.70, 0.012, 2.48],
    [0.033, 0.020, 0.58, -0.008, 3.72],
    [-0.030, 0.030, 0.46, 0.006, 5.03],
  ];

  for (const [rootX, rootZ, height, lean, angle] of blades) {
    const halfWidth = 0.013;
    const sideX = Math.cos(angle) * halfWidth;
    const sideZ = Math.sin(angle) * halfWidth;
    const tipX = rootX + Math.sin(angle) * lean;
    const tipZ = rootZ - Math.cos(angle) * lean;
    vertices.push(
      rootX - sideX, 0, rootZ - sideZ,
      rootX + sideX, 0, rootZ + sideZ,
      tipX, height, tipZ,
    );
    colors.push(
      low.r, low.g, low.b,
      low.r, low.g, low.b,
      high.r, high.g, high.b,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.triangleCount = blades.length;
  return geometry;
}

function createFlowerGeometry() {
  const vertices = [];
  const colors = [];
  const stem = new THREE.Color('#456b43');
  const petal = new THREE.Color('#e8e3c9');
  const center = new THREE.Color('#bba76b');

  function triangle(a, b, c, colorA, colorB = colorA, colorC = colorA) {
    vertices.push(...a, ...b, ...c);
    colors.push(
      colorA.r, colorA.g, colorA.b,
      colorB.r, colorB.g, colorB.b,
      colorC.r, colorC.g, colorC.b,
    );
  }

  const stemHalf = 0.004;
  triangle([-stemHalf, 0, 0], [stemHalf, 0, 0], [stemHalf, 0.73, 0], stem);
  triangle([-stemHalf, 0, 0], [stemHalf, 0.73, 0], [-stemHalf, 0.73, 0], stem);
  triangle([0, 0, -stemHalf], [0, 0, stemHalf], [0, 0.73, stemHalf], stem);
  triangle([0, 0, -stemHalf], [0, 0.73, stemHalf], [0, 0.73, -stemHalf], stem);

  const y = 0.74;
  for (let i = 0; i < 4; i += 1) {
    const angle = i * Math.PI * 0.5;
    const side = 0.018;
    const length = 0.048;
    const sx = Math.cos(angle + Math.PI * 0.5) * side;
    const sz = Math.sin(angle + Math.PI * 0.5) * side;
    const tx = Math.cos(angle) * length;
    const tz = Math.sin(angle) * length;
    triangle([-sx, y, -sz], [sx, y, sz], [tx, y + 0.006, tz], center, center, petal);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.triangleCount = 8;
  return geometry;
}

function addSoilDetails(group, width, depth, random) {
  const geometry = new THREE.IcosahedronGeometry(0.5, 0);
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 1,
    metalness: 0,
  });
  const count = THREE.MathUtils.clamp(Math.round((width + depth) * 0.44), 32, 120);
  const details = new THREE.InstancedMesh(geometry, material, count);
  details.name = 'meadow-soil-cross-section-details';
  details.castShadow = false;
  details.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const tones = ['#6f523c', '#a17e58', '#765c42', '#b08a60'];

  for (let i = 0; i < count; i += 1) {
    const horizontal = i % 2 === 0;
    const positive = i % 4 < 2;
    const along = random() - 0.5;
    if (horizontal) {
      position.set(along * width, -0.075 - random() * 0.235, (positive ? 1 : -1) * (depth * 0.5 + 0.008));
      scale.set(0.16 + random() * 0.34, 0.035 + random() * 0.055, 0.018);
    } else {
      position.set((positive ? 1 : -1) * (width * 0.5 + 0.008), -0.075 - random() * 0.235, along * depth);
      scale.set(0.018, 0.035 + random() * 0.055, 0.16 + random() * 0.34);
    }
    quaternion.setFromAxisAngle(UP, random() * TAU);
    matrix.compose(position, quaternion, scale);
    details.setMatrixAt(i, matrix);
    color.set(tones[Math.floor(random() * tones.length)]);
    details.setColorAt(i, color);
  }

  details.instanceMatrix.needsUpdate = true;
  if (details.instanceColor) details.instanceColor.needsUpdate = true;
  details.computeBoundingBox();
  details.computeBoundingSphere();
  group.add(details);
  return details;
}

function addGrass(group, width, depth, random) {
  const geometry = createGrassClusterGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const targetCells = THREE.MathUtils.clamp(Math.round((width * depth) / (0.82 ** 2)), 1, 14500);
  const columns = THREE.MathUtils.clamp(
    Math.round(Math.sqrt(targetCells * (width / depth))),
    1,
    targetCells,
  );
  const rows = Math.max(1, Math.floor(targetCells / columns));
  const cellWidth = width / columns;
  const cellDepth = depth / rows;
  const placements = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = ((column + 0.5) / columns - 0.5) * width;
      const z0 = ((row + 0.5) / rows - 0.5) * depth;
      const patch = spatialVariation(x0, z0);
      const keep = patch > 0.23 || random() > 0.34;
      if (!keep) continue;
      placements.push([
        x0 + (random() - 0.5) * cellWidth * 0.72,
        z0 + (random() - 0.5) * cellDepth * 0.72,
        patch,
      ]);
      if (patch > 0.72 && random() < 0.42 && placements.length < 15500) {
        placements.push([
          x0 + (random() - 0.5) * cellWidth * 0.68,
          z0 + (random() - 0.5) * cellDepth * 0.68,
          patch,
        ]);
      }
    }
  }

  const grass = new THREE.InstancedMesh(geometry, material, placements.length);
  grass.name = 'meadow-fine-grass-clusters';
  grass.castShadow = false;
  grass.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const low = new THREE.Color('#557a47');
  const high = new THREE.Color('#8ba967');

  placements.forEach(([x, z, patch], index) => {
    const height = 0.085 + random() * 0.048 + patch * 0.022;
    const spread = 0.76 + random() * 0.48;
    position.set(
      THREE.MathUtils.clamp(x, -width * 0.5 + 0.02, width * 0.5 - 0.02),
      0,
      THREE.MathUtils.clamp(z, -depth * 0.5 + 0.02, depth * 0.5 - 0.02),
    );
    quaternion.setFromAxisAngle(UP, random() * TAU);
    scale.set(spread, Math.min(height, 0.159), spread);
    matrix.compose(position, quaternion, scale);
    grass.setMatrixAt(index, matrix);
    color.copy(low).lerp(high, 0.3 + patch * 0.48 + random() * 0.12);
    grass.setColorAt(index, color);
  });

  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  grass.computeBoundingBox();
  grass.computeBoundingSphere();
  grass.userData.instanceCount = placements.length;
  group.add(grass);
  return grass;
}

function addFlowers(group, width, depth, random) {
  const geometry = createFlowerGeometry();
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const count = THREE.MathUtils.clamp(Math.round((width * depth) / 145), 12, 84);
  const flowers = new THREE.InstancedMesh(geometry, material, count);
  flowers.name = 'meadow-rare-low-flowers';
  flowers.castShadow = false;
  flowers.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const tint = new THREE.Color();
  const tints = ['#f2ead8', '#e4e7d8', '#d9dfcf', '#e8dccf'];
  for (let i = 0; i < count; i += 1) {
    position.set((random() - 0.5) * width * 0.97, 0, (random() - 0.5) * depth * 0.97);
    quaternion.setFromAxisAngle(UP, random() * TAU);
    const height = 0.105 + random() * 0.045;
    scale.set(0.9 + random() * 0.25, height / 0.75, 0.9 + random() * 0.25);
    matrix.compose(position, quaternion, scale);
    flowers.setMatrixAt(i, matrix);
    tint.set(tints[Math.floor(random() * tints.length)]);
    flowers.setColorAt(i, tint);
  }

  flowers.instanceMatrix.needsUpdate = true;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  flowers.computeBoundingBox();
  flowers.computeBoundingSphere();
  flowers.userData.instanceCount = count;
  group.add(flowers);
  return flowers;
}

/**
 * Create a deterministic, rectangular meadow module with its walkable top at y=0.
 * @param {{width?: number, depth?: number}} options
 * @returns {{group: THREE.Group, update: (time: number) => void, dispose: () => void}}
 */
export function createMeadow({ width = 112, depth = 96 } = {}) {
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) {
    throw new RangeError('createMeadow width and depth must be finite positive numbers');
  }

  const group = new THREE.Group();
  group.name = 'procedural-meadow';
  const random = mulberry32(0x6d656164);

  const groundGeometry = createGroundGeometry(width, depth);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.98,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.name = 'meadow-ground-y0';
  ground.position.y = 0;
  ground.receiveShadow = true;
  group.add(ground);

  const soilGeometry = new THREE.BoxGeometry(width, 0.32, depth);
  const soilMaterial = new THREE.MeshStandardMaterial({
    color: '#806247',
    roughness: 1,
    metalness: 0,
  });
  const soil = new THREE.Mesh(soilGeometry, soilMaterial);
  soil.name = 'meadow-soil-base';
  soil.position.y = -0.171;
  soil.receiveShadow = true;
  group.add(soil);

  const edgeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: '#587a47',
    roughness: 1,
    metalness: 0,
  });
  const edge = new THREE.InstancedMesh(edgeGeometry, edgeMaterial, 4);
  edge.name = 'meadow-turf-edge';
  const matrix = new THREE.Matrix4();
  matrix.compose(new THREE.Vector3(0, -0.027, depth * 0.5 - 0.045), new THREE.Quaternion(), new THREE.Vector3(width, 0.05, 0.09));
  edge.setMatrixAt(0, matrix);
  matrix.compose(new THREE.Vector3(0, -0.027, -depth * 0.5 + 0.045), new THREE.Quaternion(), new THREE.Vector3(width, 0.05, 0.09));
  edge.setMatrixAt(1, matrix);
  matrix.compose(new THREE.Vector3(width * 0.5 - 0.045, -0.027, 0), new THREE.Quaternion(), new THREE.Vector3(0.09, 0.05, Math.max(0.01, depth - 0.18)));
  edge.setMatrixAt(2, matrix);
  matrix.compose(new THREE.Vector3(-width * 0.5 + 0.045, -0.027, 0), new THREE.Quaternion(), new THREE.Vector3(0.09, 0.05, Math.max(0.01, depth - 0.18)));
  edge.setMatrixAt(3, matrix);
  edge.instanceMatrix.needsUpdate = true;
  edge.receiveShadow = true;
  edge.computeBoundingBox();
  edge.computeBoundingSphere();
  group.add(edge);

  const soilDetails = addSoilDetails(group, width, depth, random);
  const grass = addGrass(group, width, depth, random);
  const flowers = addFlowers(group, width, depth, random);

  group.userData.meadow = {
    width,
    depth,
    groundY: 0,
    maxVegetationY: 0.16,
    estimatedDrawCalls: 6,
    grassInstances: grass.userData.instanceCount,
    flowerInstances: flowers.userData.instanceCount,
    deterministicSeed: '0x6d656164',
  };

  let disposed = false;
  function update(_time) {
    // Intentionally static: the host owns the render loop and quiet grass keeps movable models legible.
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    const geometries = new Set();
    const materials = new Set();
    group.traverse((object) => {
      if (!object.isMesh) return;
      if (object.geometry) geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.filter(Boolean).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    group.clear();
  }

  // Keep named references discoverable without exposing mutable implementation globals.
  group.userData.meadow.layers = {
    ground: ground.name,
    soil: soil.name,
    turfEdge: edge.name,
    soilDetails: soilDetails.name,
    grass: grass.name,
    flowers: flowers.name,
  };

  return { group, update, dispose };
}
