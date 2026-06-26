export function defineResource(id) { return { type: "resource", id }; }
export function defineEvent(id) { return { type: "event", id }; }
export function defineComponent(id) { return { type: "component", id }; }
export function defineRuntimeKit(definition) { return definition; }

const tokenId = (token) => typeof token === "string" ? token : token?.id;

export function createRealtimeGame({ kits = [] } = {}) {
  const resources = new Map();
  const events = [];
  const log = [];
  const engine = { frame: 0 };
  const world = {
    __nexusClock: { frame: 0, delta: 0, elapsed: 0 },
    getResource(resource) { return resources.get(tokenId(resource)); },
    setResource(resource, value) { resources.set(tokenId(resource), value); return value; },
    emit(event, payload = {}) { const record = { type: tokenId(event), payload, frame: engine.frame }; events.push(record); log.push(record); return record; },
    readEvents(event = null) { return event ? events.filter((record) => record.type === tokenId(event)).map((record) => record.payload) : events.slice(); }
  };
  const systems = [];
  engine.tick = (dt = 1 / 60) => {
    engine.frame += 1;
    world.__nexusClock = { frame: engine.frame, delta: dt, elapsed: engine.frame * dt };
    for (const entry of systems) entry.system(world, engine);
    const emitted = events.slice();
    events.length = 0;
    return emitted;
  };
  engine.snapshot = () => ({ frame: engine.frame, events: log.slice(), kits: kits.map((kit) => kit.id) });
  engine.__nexus = { world, getEventLog: () => log.slice(), getInstalledKits: () => kits.map((kit) => kit.id) };
  for (const kit of kits) kit.initWorld?.({ world, engine });
  for (const kit of kits) { for (const system of kit.systems ?? []) systems.push(system); kit.install?.({ engine, world }); }
  return engine;
}

export default { defineResource, defineEvent, defineComponent, defineRuntimeKit, createRealtimeGame };
