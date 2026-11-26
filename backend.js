// Firebase backend for Study Group.
// Exposes window.SG_BACKEND.use(name) with the same small API the page uses
// ("db", "user", "room"), backed by Firestore + anonymous sign-in.
(() => {
  'use strict';
  const cfg = window.SG_FIREBASE_CONFIG;
  let ready = null;

  function init() {
    if (ready) return ready;
    if (!cfg || !cfg.apiKey || !window.firebase) { ready = Promise.resolve(null); return ready; }
    ready = (async () => {
      try {
        const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
        const auth = app.auth();
        if (!auth.currentUser) await auth.signInAnonymously();
        const fs = app.firestore();
        try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* private window or unsupported */ }
        return { auth, fs, uid: auth.currentUser.uid };
      } catch (e) {
        console.error('Study Group: Firebase failed to start', e);
        return null;
      }
    })();
    return ready;
  }

  const mapErr = (e) => {
    const c = (e && e.code) || '';
    const code = c === 'permission-denied' || c === 'failed-precondition' || c === 'invalid-argument' ? 'invalid_argument'
      : c === 'resource-exhausted' ? 'quota_exceeded' : 'unavailable';
    return { code, message: (e && e.message) || String(e) };
  };
  const wrapErr = (p) => p.catch((e) => { throw mapErr(e); });
  const wrapSnap = (s) => ({ id: s.id, exists: s.exists, data: () => s.data(), metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites } });
  const wrapQS = (s) => ({ docs: s.docs.map(wrapSnap), size: s.size, empty: s.empty, metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites }, docChanges: () => s.docChanges() });

  function wrapDoc(ref) {
    return {
      id: ref.id, path: ref.path,
      get: () => wrapErr(ref.get().then(wrapSnap)),
      set: (d) => wrapErr(ref.set(d)),
      // The page expects "update" to deep-merge nested objects; Firestore's set+merge does exactly that.
      update: (d) => wrapErr(ref.set(d, { merge: true })),
      delete: () => wrapErr(ref.delete()),
      onSnapshot: (next, err) => ref.onSnapshot((s) => next(wrapSnap(s)), (e) => err && err(mapErr(e))),
      collection: (p) => wrapQuery(ref.collection(p)),
    };
  }
  function wrapQuery(q) {
    return {
      path: q.path,
      where: (f, op, v) => wrapQuery(q.where(f, op, v)),
      orderBy: (f, dir) => wrapQuery(q.orderBy(f, dir || 'asc')),
      limit: (n) => wrapQuery(q.limit(n)),
      get: () => wrapErr(q.get().then(wrapQS)),
      onSnapshot: (next, err) => q.onSnapshot((s) => next(wrapQS(s)), (e) => err && err(mapErr(e))),
      doc: (id) => wrapDoc(id ? q.doc(id) : q.doc()),
      add: (d) => wrapErr(q.add(d).then(wrapDoc)),
    };
  }

  // "Who's here now": each open page writes rooms/<code>/presence/<uid> and refreshes it every 45 s.
  function makeRoom(b) {
    return {
      async join(name) {
        const code = String(name).replace(/^sg-/, '').toUpperCase();
        const colRef = b.fs.collection(`rooms/${code}/presence`);
        const mine = colRef.doc(b.uid);
        let last = null, beat = null, unsub = null, sweep = null, handlers = [];
        let peers = [];
        const write = () => last && mine.set({ ...last, at: Date.now() }).catch(() => {});
        const emit = () => handlers.forEach((fn) => { try { fn({ peers, joined: [], left: [], updated: [] }); } catch (e) {} });
        const recompute = (docs) => {
          const fresh = Date.now() - 2.5 * 60000;
          peers = docs.filter((d) => d.id !== b.uid && (d.data().at || 0) > fresh)
            .map((d) => ({ peer: d.id, by: d.id, isMe: false, sameTab: false, kind: 'viewer', guest: false, presence: d.data(), updatedAt: d.data().at || 0 }));
          emit();
        };
        let lastDocs = [];
        unsub = colRef.onSnapshot((s) => { lastDocs = s.docs; recompute(lastDocs); }, () => {});
        sweep = setInterval(() => recompute(lastDocs), 30000);
        beat = setInterval(write, 45000);
        const leaveNow = () => { mine.delete().catch(() => {}); };
        window.addEventListener('pagehide', leaveNow);
        return {
          name,
          presence: async (p) => { last = p; await write(); },
          onPeers: (fn) => { handlers.push(fn); setTimeout(() => fn({ peers, joined: [], left: [], updated: [] }), 0); return () => { handlers = handlers.filter((h) => h !== fn); }; },
          leave: async () => { clearInterval(beat); clearInterval(sweep); if (unsub) unsub(); window.removeEventListener('pagehide', leaveNow); leaveNow(); },
        };
      },
    };
  }

  window.SG_BACKEND = {
    async use(name) {
      const b = await init();
      if (!b) return null;
      if (name === 'db') return { doc: (p) => wrapDoc(b.fs.doc(p)), collection: (p) => wrapQuery(b.fs.collection(p)) };
      if (name === 'user') return { id: async () => b.uid };
      if (name === 'room') return makeRoom(b);
      return null;
    },
  };
})();
