// npm install --no-save linkedom@0.18.12
// node tests/render.cjs
const { parseHTML } = require('linkedom');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { window } = parseHTML('<html><body></body></html>');
let source = readFileSync(require('node:path').join(__dirname, '../printers-card.js'), 'utf8');
source = source.replace('const CARD_VERSION', 'window.updateCard = updateCard; const CARD_VERSION');
vm.runInNewContext(source, { window, document: window.document, HTMLElement: window.HTMLElement,
  customElements: window.customElements, console, setTimeout, clearTimeout,
  setInterval: () => 1, clearInterval, localStorage: { getItem: () => null }, Intl });
const { document, updateCard } = window;
const root = document.createElement('div');
const markup = (value, extra = '') => `<style>.x{color:red}</style><ha-card><header>Printer</header>${extra}<div class="pc-camw" data-entity="camera.one"><div class="pc-cam-slot"></div></div><button data-press="button.pause" class="control">${value}</button></ha-card>`;
updateCard(root, markup('Pause'));
const card = root.querySelector('ha-card'), button = root.querySelector('button');
const camera = document.createElement('img'); camera.className = 'pc-cam'; camera.src = '/stream';
root.querySelector('.pc-cam-slot').replaceWith(camera);
updateCard(root, markup('Confirm'));
assert.equal(root.querySelector('ha-card'), card);
assert.equal(root.querySelector('button'), button);
assert.equal(button.textContent, 'Confirm');
assert.equal(root.querySelector('.pc-cam'), camera);
assert.equal(camera.getAttribute('src'), '/stream');
updateCard(root, markup('Pause', '<section>New job</section>'));
assert.equal(root.querySelector('.pc-cam'), camera);
assert.equal(root.querySelector('button'), button);
updateCard(root, markup('Pause'));
assert.equal(root.querySelector('.pc-cam'), camera);
assert.equal(root.querySelector('section'), null);
updateCard(root, '<ha-card class="alert"><button data-press="button.cancel" disabled>Cancel</button></ha-card>');
assert.equal(root.querySelector('ha-card'), card);
assert.equal(card.className, 'alert');
assert.equal(root.querySelector('.pc-cam'), null);
assert.equal(root.querySelector('button').hasAttribute('disabled'), true);
// Exercise the actual camera lifecycle, including changing mode with a retained image.
const printer = document.createElement('printers-card');
printer._config = { camera_mode: 'live' };
printer.attachShadow({ mode: 'open' });
printer._st = () => ({ attributes: { entity_picture: '/api/camera_proxy/one?token=x' } });
document.body.append(printer);
updateCard(printer.shadowRoot, markup('Pause'));
printer._camMount('camera.one');
const live = printer._camEl;
assert.equal(live.isConnected, true);
assert.equal(live.getAttribute('src'), '/api/camera_proxy_stream/one?token=x');
updateCard(printer.shadowRoot, markup('Confirm'));
printer._camMount('camera.one');
assert.equal(printer._camEl, live);
assert.equal(live.isConnected, true);
printer._config.camera_mode = 'snapshot';
printer._camMount('camera.one');
assert.notEqual(printer._camEl, live);
assert.equal(printer._camEl.isConnected, true);
assert.match(printer._camEl.getAttribute('src'), /camera_proxy\/one\?token=x&_=/);
printer.remove();
assert.equal(printer._camEl, null);
console.log('PASS: retained nodes, text/attribute updates, section insertion/removal, camera reuse/mode switch/cleanup');
