export class FakeDB {
  constructor() { this.data = new Map(); }
  collection(path) { return this.query(path); }
  query(path, filters = [], order = null, cap = Infinity) {
    return { path,
      doc: id => ({ path: path + '/' + id, id, collection: name => this.query(path + '/' + id + '/' + name), create: async value => this.data.set(path + '/' + id, structuredClone(value)) }),
      where: (k, op, v) => this.query(path, [...filters, [k,v]], order, cap),
      orderBy: k => this.query(path, filters, k, cap), limit: n => this.query(path, filters, order, n),
      get: async () => {
        let rows = [...this.data].filter(([p,d]) => p.startsWith(path + '/') && p.split('/').length === path.split('/').length + 1 && filters.every(([k,v]) => d[k] === v));
        if (order) rows.sort((a,b) => a[1][order] - b[1][order]);
        return { docs: rows.slice(0,cap).map(([p,d]) => ({ ref: { path: p }, data: () => structuredClone(d) })) };
      }
    };
  }
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      get: async ref => ref.get ? ref.get() : { exists: this.data.has(ref.path), data: () => structuredClone(this.data.get(ref.path)) },
      create: (ref,d) => writes.push(() => this.data.set(ref.path, structuredClone(d))),
      update: (ref,d) => writes.push(() => this.data.set(ref.path, { ...this.data.get(ref.path), ...d })),
      delete: ref => writes.push(() => this.data.delete(ref.path))
    };
    const result = await fn(tx); writes.forEach(w => w()); return result;
  }
}
