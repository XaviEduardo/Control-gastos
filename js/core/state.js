// Estado en memoria de la aplicación. Los módulos leen/escriben aquí, nunca en StorageService
// directamente, para no releer todo el storage en cada render (ver docs/architecture.md).

import StorageService from './storage.js';
import { emit } from './events.js';

let state = null;

function init(seedFactory) {
  state = StorageService.init(seedFactory);
  return state;
}

function getState() {
  return state;
}

function getCollection(name) {
  return state ? state[name] || [] : [];
}

function setCollection(name, data) {
  state[name] = data;
  StorageService.set(name, data);
  emit(`change:${name}`, data);
  emit('change', { collection: name });
}

function getSettings() {
  return state ? state.settings : {};
}

function setSettings(partial) {
  state.settings = { ...state.settings, ...partial };
  StorageService.setSettings(partial);
  emit('change:settings', state.settings);
  emit('change', { collection: 'settings' });
}

export default { init, getState, getCollection, setCollection, getSettings, setSettings };
