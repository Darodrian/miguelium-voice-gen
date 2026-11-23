import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('index.html exposes every control the UI wiring uses', () => {
  const html = readFileSync('index.html', 'utf8');
  for (const id of ['preset','language','reroll','text','play','stop','format','bitrate','quality','save','status','controls','custom-wav','custom-map','sprite-mode']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
});

test('preset add/rename/delete buttons are wired in main.js', () => {
  const main = readFileSync('src/main.js', 'utf8');
  for (const id of ['preset-add', 'preset-rename', 'preset-delete']) {
    assert.ok(main.includes(`document.getElementById('${id}')`), id);
  }
  assert.ok(main.includes("elements.presetAdd.addEventListener('click', handleAddPreset)"));
  assert.ok(main.includes("elements.presetRename.addEventListener('click', handleRenamePreset)"));
  assert.ok(main.includes("elements.presetDelete.addEventListener('click', handleDeletePreset)"));
});

test('rename and delete refresh the preset list and keep the selection valid', () => {
  const main = readFileSync('src/main.js', 'utf8');
  const rename = main.slice(main.indexOf('function handleRenamePreset()'), main.indexOf('function handleDeletePreset()'));
  assert.ok(rename.includes('refreshPresetOptions();'), 'rename refreshes the preset options');
  assert.ok(rename.includes('elements.preset.value = renamed.id'), 'rename reselects the renamed record');
  const del = main.slice(main.indexOf('function handleDeletePreset()'), main.indexOf('function handleCustomFileChange()'));
  assert.ok(del.includes('refreshPresetOptions();'), 'delete refreshes the preset options');
  assert.ok(del.includes('renderControls();'), 'delete updates the rendered controls when the selection is deleted');
});

test('editing a control refreshes its value display from the normalized setting', () => {
  const main = readFileSync('src/main.js', 'utf8');
  assert.ok(main.includes('function syncPresetSelector()'), 'syncPresetSelector helper exists');
  const applyBody = main.slice(main.indexOf('function applySetting('), main.indexOf('const CONTROL_DEFS'));
  assert.ok(applyBody.includes('refreshControlDisplay(def'), 'applySetting refreshes the control display');
  assert.ok(applyBody.includes('syncPresetSelector()'), 'applySetting syncs the preset selector');
  const refreshBody = main.slice(main.indexOf('function refreshControlDisplay('), main.indexOf('function bindControls()'));
  assert.ok(refreshBody.includes('setControlValue(def.id, value)'), 'refreshControlDisplay reuses setControlValue');
  assert.ok(refreshBody.includes('def.path.split(\'.\')'), 'display reads the value at the setting path');
  assert.ok(refreshBody.includes('state.settings'), 'display reads the normalized setting');
});

test('setControlValue leaves a text input that already shows the normalized value', () => {
  const main = readFileSync('src/main.js', 'utf8');
  const valueBody = main.slice(main.indexOf('function setControlValue('), main.indexOf('function renderControls()'));
  assert.ok(valueBody.includes('el.value !== next'), 'setControlValue only writes when the value differs');
});

test('applySetting reveals custom-only controls after a sprite-source change', () => {
  const main = readFileSync('src/main.js', 'utf8');
  const applyBody = main.slice(main.indexOf('function applySetting('), main.indexOf('const CONTROL_DEFS'));
  assert.ok(applyBody.includes('renderControls();'), 'applySetting calls renderControls() so custom controls are revealed');
});
