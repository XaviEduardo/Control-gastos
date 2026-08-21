// V2-2 (ver docs/v2-roadmap.md / docs/v2-data-model.md): "Store" evolucionó a
// StoreChain→StoreBranch (ver store-chain.repository.js / store-branch.repository.js). Este
// archivo se conserva como capa de compatibilidad — misma interfaz exacta de siempre
// (`list/getById/create/update/setStatus`) — para que price-history.module.js, price-form.js,
// reports.module.js, etc. sigan funcionando sin ningún cambio, ahora leyendo/escribiendo
// transparentemente sobre `storeBranches` (la fuente viva) en vez de la colección `stores`
// (congelada desde la migración, nunca más se escribe ahí — se conserva intacta sin borrarse,
// ver docs/v2-migration-plan.md). Si se crea una tienda sin `chainId` explícito (código viejo
// que no conoce el concepto de cadena), se le crea automáticamente su propia cadena homónima —
// mismo criterio que ya usó la migración para las tiendas existentes.

import StoreChainRepository from './store-chain.repository.js';
import StoreBranchRepository from './store-branch.repository.js';

function list(opts) {
  return StoreBranchRepository.list(opts);
}

function getById(id) {
  return StoreBranchRepository.getById(id);
}

function create(data) {
  const chainId = data.chainId || StoreChainRepository.create({ name: data.name }).id;
  return StoreBranchRepository.create({ ...data, chainId });
}

function update(id, patch) {
  return StoreBranchRepository.update(id, patch);
}

function setStatus(id, status) {
  return StoreBranchRepository.setStatus(id, status);
}

export default { list, getById, create, update, setStatus };
