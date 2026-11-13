// npm install --no-save linkedom@0.18.12; node tests/temperature.cjs
const { parseHTML } = require('linkedom');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { window } = parseHTML('<html><body></body></html>');
let source = readFileSync(require('node:path').join(__dirname, '../printers-card.js'), 'utf8');
source = source.replace('const CARD_VERSION', 'window.temperatureC = temperatureC; const CARD_VERSION');
vm.runInNewContext(source, { window, document: window.document, HTMLElement: window.HTMLElement,
 customElements: window.customElements, console, setTimeout, clearTimeout, setInterval: () => 1, clearInterval,
 localStorage: { getItem: () => null }, Intl });
const state = (value, unit) => ({ state: String(value), attributes: { unit_of_measurement: unit } });
for (const [value, unit, expected] of [[392,'°F',200],[200,'°C',200],[473.15,'K',200],[32,'°F',0],[0,'°C',0],[-40,'°F',-40],[25,undefined,25]]) {
 assert.ok(Math.abs(window.temperatureC(state(value,unit)) - expected) < 1e-9);
}
for (const value of ['unavailable','unknown','', ' ', 'NaN', 'Infinity']) assert.equal(window.temperatureC(state(value,'°F')), null);
assert.equal(window.temperatureC(state(20,'%')), null);
assert.equal(window.temperatureC(undefined), null);
const card = window.document.createElement('printers-card');
const printer = {id:'printer',name:'Printer',roles:{ext:'sensor.nozzle',ext_target:'number.target',bed:'sensor.bed',bed_target_s:'sensor.bed_target',chamber:'sensor.chamber'},cameras:[],outputs:[],others:['sensor.host']};
card._resolve = () => [printer]; card._status = () => 'idle'; card._power = () => null;
card.setConfig({show_job:false,show_camera:false,show_controls:false,show_stats:false,show_device:false});
const states = {'sensor.nozzle':state(392,'°F'),'number.target':state(210,'°C'),'sensor.bed':state(60,'°C'),'sensor.bed_target':state(140,'°F'),'sensor.chamber':state(308.15,'K'),'sensor.host':state(122,'°F')};
const hass = { states, locale:{language:'en'}, themes:{darkMode:false} };
card.hass = hass;
const root = card.shadowRoot;
const nozzle = () => root.querySelector('[data-entity="sensor.nozzle"]');
assert.match(nozzle().textContent,/200\s*°C/);
assert.match(nozzle().textContent,/Target 210 °C/);
assert.match(root.querySelector('[data-entity="sensor.host"]').textContent,/50 °C/);
assert.match(root.querySelector('[data-entity="sensor.chamber"]').textContent,/35.*°C/);
const retained = nozzle();
states['sensor.nozzle'] = state(392,'°C'); card.hass = hass;
assert.equal(nozzle(),retained);
assert.match(nozzle().textContent,/392\s*°C/);
states['sensor.nozzle'] = state(392,'°F');
card.setConfig({...card._config, temperature_unit:'fahrenheit'});
assert.match(nozzle().textContent,/392\s*°F/);
assert.match(nozzle().textContent,/Target 410 °F/);
assert.match(root.querySelector('[data-entity="sensor.host"]').textContent,/122 °F/);
states['number.target'] = state(32,'°F');
states['sensor.nozzle'] = state(100,'°F'); card.hass = hass;
assert.doesNotMatch(nozzle().textContent,/Target|Cooling/);
assert.equal(nozzle().classList.contains('hot'),false);
states['sensor.nozzle'] = state(113,'°F'); card.hass = hass;
assert.match(nozzle().textContent,/Cooling down/);
states['sensor.nozzle'] = state('unavailable','°F'); card.hass = hass;
assert.equal(nozzle(),null);
// auto (par défaut) : l'unité de Home Assistant
states['sensor.nozzle'] = state(392,'°F'); states['number.target'] = state(210,'°C');
card.setConfig({...card._config, temperature_unit:'auto'});
hass.config = { unit_system: { temperature: '°F' } }; card._sig = null; card.hass = hass;
assert.match(nozzle().textContent,/392\s*°F/);
hass.config = { unit_system: { temperature: '°C' } }; card._sig = null; card.hass = hass;
assert.match(nozzle().textContent,/200\s*°C/);
console.log('PASS: auto unit, conversions, mixed targets, auxiliary temperatures, unit-only updates, Fahrenheit display, off/cooling thresholds, unavailable states');
