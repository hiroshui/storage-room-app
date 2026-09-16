'use strict';

// Lightweight regression coverage for planner math without a browser. The test
// evaluates app.js without booting the UI and exercises the pure geometry helpers.
const fs = require('fs');
const vm = require('vm');

let code = fs.readFileSync('static/app.js', 'utf8');
code = code.replace(/registerEvents\(\);\s*boot\(\)\.catch\([\s\S]*$/m, '');
code += '\n;globalThis.__plannerTest={normalizeFixture,fixtureEndpoint,doorSwingDirection,state,snap};';

const dummy = {};
const context = {
  console,
  document: { querySelector: () => dummy, querySelectorAll: () => [], body: { classList: { add() {}, remove() {} } } },
  window: { setTimeout() {}, addEventListener() {}, location: {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  URLSearchParams,
  Response,
  fetch: async () => {},
  setTimeout() {},
};
vm.createContext(context);
vm.runInContext(code, context);

const test = context.__plannerTest;
test.state.layout = { width: 4, height: 3, layout: { ceiling_height: 2.5, locations: {}, fixtures: [] } };

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const leftWallDoor = test.normalizeFixture({ kind: 'door', x: 0, y: 0.5, w: 0.9, h: 0.08, rotation: 90, height: 0.1 }, 4, 3);
const closedEnd = test.fixtureEndpoint(leftWallDoor, 0);
const openEnd = test.fixtureEndpoint(leftWallDoor, test.doorSwingDirection(leftWallDoor) * 90);

assertEqual(leftWallDoor.x, 0, 'left-wall door anchor X');
assertEqual(leftWallDoor.y, 0.5, 'left-wall door anchor Y');
assertEqual(closedEnd.x, 0, 'vertical door stays on X=0');
assertEqual(closedEnd.y, 1.4, 'vertical door endpoint');
assertEqual(openEnd.x, 0.9, 'left-wall door swings into room');
assertEqual(openEnd.y, 0.5, 'left-wall door swing Y');
assertEqual(test.snap(0.127), 0.13, '1 cm snap');
assertEqual(test.snap(1.001), 1, '1 cm snap lower edge');

console.log('planner geometry tests: OK');
