import * as CANNON from 'cannon-es';

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

const agentBodies = {};

function addAgent(agentId, x, y, z) {
  const shape = new CANNON.Sphere(0.5);
  const body = new CANNON.Body({ mass: 1, shape });
  body.position.set(x,y,z);
  world.addBody(body);
  agentBodies[agentId] = body;
}
function findPath(start, goal, grid) {
  // A* implementation: safe, deterministic, not ML-based
}
function moveAgent(agentId, target) {
  const body = agentBodies[agentId];
  const path = findPath(body.position, target, officeGrid);

  applyImpulseAlongPath(body, path);
}
