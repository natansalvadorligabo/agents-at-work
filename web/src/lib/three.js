// The only module that imports three.js. Everything else imports from here, so upgrading or swapping
// the renderer touches one file. In the browser "three" maps to web/vendor via the page's import map;
// in Node tests it resolves to the pinned devDependency of the same version (r169).
export {
  BoxGeometry,
  BufferGeometry,
  Camera,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  OrthographicCamera,
  PCFShadowMap,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
