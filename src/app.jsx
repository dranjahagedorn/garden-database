// ════════════════════════════════════════════════════════════
// GARTEN-APP v2 – React + Supabase
// Features: Login, Pflanzendatenbank, Logbuch, Gartenplan,
//           QR-Codes, Pflegekalender (Monatsansicht)
// ════════════════════════════════════════════════════════════
// ⚠️  HIER DEINE SUPABASE-DATEN EINTRAGEN:
const SUPABASE_URL = "https://rzdyughiamhbbdqfqzil.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZHl1Z2hpYW1oYmJkcWZxemlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTU1MzksImV4cCI6MjA5MzI5MTUzOX0.9MG3bbo2w4krlp5BaCwEdJCr_naCffBVrWVLIlMPPX0";
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";

// ─── Supabase Client (inline, kein npm nötig) ───
const sb = (() => {
  const headers = { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  const authHeaders = (token) => ({ ...headers, Authorization: `Bearer ${token}` });

  const rpc = async (path, opts = {}) => {
    const res = await fetch(`${SUPABASE_URL}${path}`, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || json.error_description || "Fehler");
    return json;
  };

  return {
    auth: {
      signIn: (email, password) =>
        rpc("/auth/v1/token?grant_type=password", { method: "POST", headers, body: JSON.stringify({ email, password }) }),
      signOut: (token) =>
        rpc("/auth/v1/logout", { method: "POST", headers: authHeaders(token) }),
    },
    from: (table, token) => ({
      select: (query = "*", filters = "") =>
        rpc(`/rest/v1/${table}?select=${query}${filters ? "&" + filters : ""}`, { headers: { ...authHeaders(token), Prefer: "return=representation" } }),
      insert: (data) =>
        rpc(`/rest/v1/${table}`, { method: "POST", headers: { ...authHeaders(token), Prefer: "return=representation" }, body: JSON.stringify(data) }),
      update: (data, filter) =>
        rpc(`/rest/v1/${table}?${filter}`, { method: "PATCH", headers: { ...authHeaders(token), Prefer: "return=representation" }, body: JSON.stringify(data) }),
      delete: (filter) =>
        rpc(`/rest/v1/${table}?${filter}`, { method: "DELETE", headers: authHeaders(token) }),
    }),
  };
})();

// ─── Konstanten ───
const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MONATE_LANG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const AUFGABEN_TYPEN = ["Gießen", "Düngen", "Schneiden", "Umpflanzen", "Ernten", "Schädlingscheck", "Mulchen", "Überwintern"];
const KAT = [
  { id: "zierpflanzen", label: "Zierpflanzen", emoji: "🌸", color: "#e879a0" },
  { id: "gemuese",      label: "Gemüse",       emoji: "🥕", color: "#f97316" },
  { id: "beeren",       label: "Beeren",        emoji: "🫐", color: "#7c3aed" },
  { id: "obstbaeume",   label: "Obstbäume",     emoji: "🍎", color: "#16a34a" },
];

// ─── Theme ───
const T = {
  bg: "#faf9f7", card: "#ffffff", border: "#e8e3db", muted: "#9c8f80",
  text: "#2d2416", accent: "#5a7a3a", accentL: "#eef3e8",
  warm: "#c4773a", warmL: "#fdf4ec", red: "#dc2626", redL: "#fef2f2",
  shadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
};

// ─── Style Helpers ───
const crd = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: T.shadow };
const btn = (v = "p") => ({
  padding: v === "s" ? "6px 14px" : "10px 20px", fontSize: v === "s" ? 13 : 14,
  borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600,
  background: v === "p" ? T.accent : v === "d" ? T.red : v === "w" ? T.warm : T.accentL,
  color: v === "p" ? "#fff" : v === "d" ? "#fff" : v === "w" ? "#fff" : T.accent,
  transition: "opacity .15s",
});
const inp = { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 14, background: T.bg, boxSizing: "border-box", outline: "none" };
const lbl = { fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: .5, marginTop: 12, marginBottom: 4 };
const tag = (color, bg) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg, border: `1px solid ${color}30` });
const curMonth = () => new Date().getMonth() + 1;

// ════════════════════════════════════════════════════════════
export default function GartenApp() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState("db"); // db | plant | editPlant | logbook | map | calendar
  const [plants, setPlants] = useState([]);
  const [logEntries, setLogEntries] = useState([]);
  const [kalender, setKalender] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [editLog, setEditLog] = useState(null);
  const [editKal, setEditKal] = useState(null);
  const [filterKat, setFilterKat] = useState("");
  const [search, setSearch] = useState("");
  const [calMonth, setCalMonth] = useState(curMonth());
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const sel = plants.find(p => p.id === selectedId);
  const token = session?.access_token;

  const notify = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  // ─── Data Loading ───
  const loadPlants = useCallback(async () => {
    if (!token) return;
    const data = await sb.from("pflanzen", token).select("*", "order=nummer.asc");
    setPlants(Array.isArray(data) ? data : []);
  }, [token]);

  const loadLog = useCallback(async () => {
    if (!token) return;
    const data = await sb.from("logbuch", token).select("*", "order=datum.desc");
    setLogEntries(Array.isArray(data) ? data : []);
  }, [token]);

  const loadKalender = useCallback(async () => {
    if (!token) return;
    const data = await sb.from("pflege_kalender", token).select("*", "order=monat.asc");
    setKalender(Array.isArray(data) ? data : []);
  }, [token]);

  useEffect(() => {
    if (token) { loadPlants(); loadLog(); loadKalender(); }
  }, [token, loadPlants, loadLog, loadKalender]);

  // ─── Plant CRUD ───
  const savePlant = async () => {
    setLoading(true);
    try {
      if (editData.id) {
        const { id, user_id, created_at, ...rest } = editData;
        await sb.from("pflanzen", token).update(rest, `id=eq.${id}`);
      } else {
        const { id, ...rest } = editData;
        await sb.from("pflanzen", token).insert({ ...rest, user_id: session.user.id });
      }
      await loadPlants();
      setView("db"); setEditData(null); notify("✅ Pflanze gespeichert");
    } catch (e) { notify("❌ " + e.message); }
    setLoading(false);
  };

  const deletePlant = async (id) => {
    if (!confirm("Pflanze löschen?")) return;
    await sb.from("pflanzen", token).delete(`id=eq.${id}`);
    await loadPlants(); setView("db"); setSelectedId(null); notify("🗑️ Gelöscht");
  };

  // ─── Log CRUD ───
  const saveLog = async () => {
    setLoading(true);
    try {
      if (editLog.id) {
        const { id, user_id, created_at, ...rest } = editLog;
        await sb.from("logbuch", token).update(rest, `id=eq.${id}`);
      } else {
        const { id, ...rest } = editLog;
        await sb.from("logbuch", token).insert({ ...rest, user_id: session.user.id });
      }
      await loadLog(); setEditLog(null); notify("✅ Eintrag gespeichert");
    } catch (e) { notify("❌ " + e.message); }
    setLoading(false);
  };

  const deleteLog = async (id) => {
    await sb.from("logbuch", token).delete(`id=eq.${id}`);
    await loadLog(); notify("🗑️ Eintrag gelöscht");
  };

  // ─── Kalender CRUD ───
  const saveKal = async () => {
    setLoading(true);
    try {
      if (editKal.id) {
        const { id, user_id, created_at, ...rest } = editKal;
        await sb.from("pflege_kalender", token).update(rest, `id=eq.${id}`);
      } else {
        const { id, ...rest } = editKal;
        await sb.from("pflege_kalender", token).insert({ ...rest, user_id: session.user.id });
      }
      await loadKalender(); setEditKal(null); notify("✅ Kalenderaufgabe gespeichert");
    } catch (e) { notify("❌ " + e.message); }
    setLoading(false);
  };

  const deleteKal = async (id) => {
    await sb.from("pflege_kalender", token).delete(`id=eq.${id}`);
    await loadKalender(); notify("🗑️ Aufgabe gelöscht");
  };

  // ─── QR Code ───
  const qrUrl = (p) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href + "?pflanze=" + p.nummer)}`;

  // ─── Login Screen ───
  if (!session) return <LoginScreen onLogin={setSession} />;

  // ─── Filtered Plants ───
  const filtered = plants.filter(p =>
    (!filterKat || p.kategorie === filterKat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || String(p.nummer).includes(search))
  );

  // ─── Modals ───
  const EditPlantModal = () => editData && (
    <Modal title={editData.id ? "Pflanze bearbeiten" : "Neue Pflanze"} onClose={() => setEditData(null)}>
      <div style={lbl}>Name *</div>
      <input style={inp} value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="z.B. Tomate" />
      <div style={lbl}>Botanischer Name</div>
      <input style={inp} value={editData.art_botanisch} onChange={e => setEditData({ ...editData, art_botanisch: e.target.value })} placeholder="z.B. Solanum lycopersicum" />
      <div style={lbl}>Kategorie *</div>
      <select style={inp} value={editData.kategorie} onChange={e => setEditData({ ...editData, kategorie: e.target.value })}>
        {KAT.map(k => <option key={k.id} value={k.id}>{k.emoji} {k.label}</option>)}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={lbl}>Nummer</div>
          <input style={inp} type="number" value={editData.nummer} onChange={e => setEditData({ ...editData, nummer: +e.target.value })} />
        </div>
        <div>
          <div style={lbl}>Emoji / Symbol</div>
          <input style={inp} value={editData.foto_emoji} onChange={e => setEditData({ ...editData, foto_emoji: e.target.value })} />
        </div>
      </div>
      <div style={lbl}>Standort (Bereich im Garten)</div>
      <input style={inp} value={editData.standort} onChange={e => setEditData({ ...editData, standort: e.target.value })} placeholder="z.B. Beet Süd, Terrasse, Gewächshaus" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={lbl}>Licht</div>
          <select style={inp} value={editData.licht} onChange={e => setEditData({ ...editData, licht: e.target.value })}>
            {["Sonne", "Halbschatten", "Schatten"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <div style={lbl}>Boden</div>
          <select style={inp} value={editData.boden} onChange={e => setEditData({ ...editData, boden: e.target.value })}>
            {["Normal", "Sandig", "Lehmig", "Humusreich"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={lbl}>Gepflanzt</div>
      <input style={inp} value={editData.gepflanzt} onChange={e => setEditData({ ...editData, gepflanzt: e.target.value })} placeholder="z.B. Frühjahr 2023" />
      <div style={lbl}>Notizen</div>
      <textarea style={{ ...inp, height: 80, resize: "vertical" }} value={editData.notizen} onChange={e => setEditData({ ...editData, notizen: e.target.value })} />
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={btn("p")} onClick={savePlant} disabled={loading}>{loading ? "…" : "Speichern"}</button>
        <button style={btn()} onClick={() => setEditData(null)}>Abbrechen</button>
        {editData.id && <button style={{ ...btn("d"), marginLeft: "auto" }} onClick={() => deletePlant(editData.id)}>Löschen</button>}
      </div>
    </Modal>
  );

  const EditLogModal = () => editLog && (
    <Modal title={editLog.id ? "Eintrag bearbeiten" : "Neuer Eintrag"} onClose={() => setEditLog(null)}>
      <div style={lbl}>Typ</div>
      <div style={{ display: "flex", gap: 8 }}>
        {["pflege", "krankheit"].map(t => (
          <button key={t} style={{ ...btn(editLog.typ === t ? "p" : ""), flex: 1 }} onClick={() => setEditLog({ ...editLog, typ: t })}>
            {t === "pflege" ? "🌿 Pflege" : "🐛 Krankheit"}
          </button>
        ))}
      </div>
      <div style={lbl}>Pflanze</div>
      <select style={inp} value={editLog.pflanze_id} onChange={e => setEditLog({ ...editLog, pflanze_id: e.target.value })}>
        <option value="">– Pflanze wählen –</option>
        {plants.map(p => <option key={p.id} value={p.id}>#{p.nummer} {p.name}</option>)}
      </select>
      <div style={lbl}>Datum</div>
      <input style={inp} type="date" value={editLog.datum} onChange={e => setEditLog({ ...editLog, datum: e.target.value })} />
      <div style={lbl}>Titel</div>
      <input style={inp} value={editLog.titel} onChange={e => setEditLog({ ...editLog, titel: e.target.value })} placeholder="Was wurde gemacht?" />
      <div style={lbl}>Beschreibung</div>
      <textarea style={{ ...inp, height: 70, resize: "vertical" }} value={editLog.beschreibung} onChange={e => setEditLog({ ...editLog, beschreibung: e.target.value })} />
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={btn("p")} onClick={saveLog} disabled={loading}>{loading ? "…" : "Speichern"}</button>
        <button style={btn()} onClick={() => setEditLog(null)}>Abbrechen</button>
        {editLog.id && <button style={{ ...btn("d"), marginLeft: "auto" }} onClick={async () => { await deleteLog(editLog.id); setEditLog(null); }}>Löschen</button>}
      </div>
    </Modal>
  );

  const EditKalModal = () => editKal && (
    <Modal title={editKal.id ? "Aufgabe bearbeiten" : "Neue Kalenderaufgabe"} onClose={() => setEditKal(null)}>
      <div style={lbl}>Pflanze</div>
      <select style={inp} value={editKal.pflanze_id} onChange={e => setEditKal({ ...editKal, pflanze_id: e.target.value })}>
        <option value="">– Pflanze wählen –</option>
        {plants.map(p => <option key={p.id} value={p.id}>#{p.nummer} {p.name}</option>)}
      </select>
      <div style={lbl}>Monat</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
        {MONATE.map((m, i) => (
          <button key={i} style={{ ...btn(editKal.monat === i + 1 ? "p" : ""), padding: "5px 10px", fontSize: 12 }}
            onClick={() => setEditKal({ ...editKal, monat: i + 1 })}>{m}</button>
        ))}
      </div>
      <div style={lbl}>Aufgabe</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
        {AUFGABEN_TYPEN.map(a => (
          <button key={a} style={{ ...btn(editKal.aufgabe === a ? "w" : ""), padding: "5px 10px", fontSize: 12 }}
            onClick={() => setEditKal({ ...editKal, aufgabe: a })}>{a}</button>
        ))}
      </div>
      <input style={inp} value={editKal.aufgabe} onChange={e => setEditKal({ ...editKal, aufgabe: e.target.value })} placeholder="Oder eigene Aufgabe eingeben…" />
      <div style={lbl}>Hinweis (optional)</div>
      <input style={inp} value={editKal.hinweis || ""} onChange={e => setEditKal({ ...editKal, hinweis: e.target.value })} placeholder="z.B. 2x pro Woche, Kaliummangel beachten" />
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={btn("p")} onClick={saveKal} disabled={!editKal.pflanze_id || !editKal.aufgabe || loading}>{loading ? "…" : "Speichern"}</button>
        <button style={btn()} onClick={() => setEditKal(null)}>Abbrechen</button>
        {editKal.id && <button style={{ ...btn("d"), marginLeft: "auto" }} onClick={async () => { await deleteKal(editKal.id); setEditKal(null); }}>Löschen</button>}
      </div>
    </Modal>
  );

  // ─── Plant Detail ───
  const PlantView = () => {
    if (!sel) return null;
    const p = sel;
    const kat = KAT.find(k => k.id === p.kategorie);
    const pLog = logEntries.filter(l => l.pflanze_id === p.id);
    const pKal = kalender.filter(k => k.pflanze_id === p.id).sort((a, b) => a.monat - b.monat);

    return (
      <div>
        <button style={{ ...btn("s"), marginBottom: 10 }} onClick={() => { setView("db"); setSelectedId(null); }}>← Datenbank</button>
        <div style={crd}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ fontSize: 36, width: 56, height: 56, borderRadius: 14, background: `${kat?.color || T.accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.foto_emoji}</div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 19 }}>{p.name}</h2>
              <div style={{ fontStyle: "italic", color: T.muted, fontSize: 13 }}>{p.art_botanisch}</div>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                <span style={tag(kat?.color || T.accent, `${kat?.color || T.accent}18`)}>#{p.nummer}</span>
                <span style={tag(kat?.color || T.accent, `${kat?.color || T.accent}18`)}>{kat?.emoji} {kat?.label}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px", marginTop: 8 }}>
            <div><div style={lbl}>Standort</div><div style={{ fontSize: 14 }}>{p.standort || "–"}</div></div>
            <div><div style={lbl}>Gepflanzt</div><div style={{ fontSize: 14 }}>{p.gepflanzt || "–"}</div></div>
            <div><div style={lbl}>Licht</div><div style={{ fontSize: 14 }}>{p.licht}</div></div>
            <div><div style={lbl}>Boden</div><div style={{ fontSize: 14 }}>{p.boden}</div></div>
          </div>
          {p.notizen && <><div style={lbl}>Notizen</div><div style={{ fontSize: 13, background: T.warmL, padding: "10px 12px", borderRadius: 8, lineHeight: 1.5 }}>{p.notizen}</div></>}

          {/* Pflegekalender */}
          <div style={lbl}>Pflegekalender</div>
          {pKal.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginTop: 4 }}>
              {MONATE.map((m, i) => {
                const tasks = pKal.filter(k => k.monat === i + 1);
                const isCur = i + 1 === curMonth();
                return (
                  <div key={i} style={{ background: isCur ? T.accentL : tasks.length ? T.warmL : T.bg, border: `1px solid ${isCur ? T.accent : T.border}`, borderRadius: 8, padding: "6px 8px", minHeight: 56 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isCur ? T.accent : T.muted }}>{m}</div>
                    {tasks.map(t => (
                      <div key={t.id} style={{ fontSize: 11, color: T.text, marginTop: 2 }}>• {t.aufgabe}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: T.muted }}>Noch keine Aufgaben eingetragen.
              <button style={{ ...btn("s"), marginLeft: 8, fontSize: 12 }} onClick={() => setEditKal({ id: null, pflanze_id: p.id, monat: curMonth(), aufgabe: "", hinweis: "" })}>+ Aufgabe</button>
            </div>
          )}
          {pKal.length > 0 && <button style={{ ...btn("s"), marginTop: 8 }} onClick={() => setEditKal({ id: null, pflanze_id: p.id, monat: curMonth(), aufgabe: "", hinweis: "" })}>+ Aufgabe</button>}

          {/* QR Code */}
          <div style={lbl}>QR-Code</div>
          <img src={qrUrl(p)} alt="QR" style={{ width: 120, height: 120, borderRadius: 8 }} />
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Zum Pflanzenschild drucken → direkter Link zu Pflanze #{p.nummer}</div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button style={btn("p")} onClick={() => { setEditData({ ...p }); }}>✏️ Bearbeiten</button>
          </div>
        </div>

        {/* Logbuch der Pflanze */}
        <div style={{ ...crd, marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>🗒️ Logbuch</h3>
            <button style={btn("s")} onClick={() => setEditLog({ id: null, pflanze_id: p.id, typ: "pflege", datum: new Date().toISOString().split("T")[0], titel: "", beschreibung: "" })}>+ Eintrag</button>
          </div>
          {pLog.length === 0 && <div style={{ fontSize: 13, color: T.muted, marginTop: 8 }}>Noch keine Einträge.</div>}
          {pLog.map(l => (
            <div key={l.id} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={tag(l.typ === "pflege" ? T.accent : T.red, l.typ === "pflege" ? T.accentL : T.redL)}>{l.typ === "pflege" ? "🌿" : "🐛"} {l.typ}</span>
                  <span style={{ fontSize: 12, color: T.muted, marginLeft: 8 }}>{l.datum}</span>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{l.titel}</div>
                  {l.beschreibung && <div style={{ fontSize: 13, color: T.muted }}>{l.beschreibung}</div>}
                </div>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 16, padding: 2 }} onClick={() => setEditLog({ ...l })}>✏️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Kalender View ───
  const CalendarView = () => {
    const monthTasks = kalender.filter(k => k.monat === calMonth);
    const grouped = {};
    monthTasks.forEach(k => {
      if (!grouped[k.pflanze_id]) grouped[k.pflanze_id] = [];
      grouped[k.pflanze_id].push(k);
    });
    const isCurMonth = calMonth === curMonth();

    return (
      <div>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>📅 Pflegekalender</h2>

        {/* Monatsnavigation */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
          {MONATE.map((m, i) => {
            const hasTasks = kalender.some(k => k.monat === i + 1);
            const isCur = i + 1 === curMonth();
            return (
              <button key={i} onClick={() => setCalMonth(i + 1)} style={{
                padding: "6px 10px", borderRadius: 8, border: `2px solid ${calMonth === i + 1 ? T.accent : isCur ? T.warm : T.border}`,
                background: calMonth === i + 1 ? T.accent : "transparent", color: calMonth === i + 1 ? "#fff" : isCur ? T.warm : T.text,
                fontWeight: calMonth === i + 1 || isCur ? 700 : 400, cursor: "pointer", fontSize: 13,
                position: "relative"
              }}>
                {m}
                {hasTasks && calMonth !== i + 1 && <span style={{ position: "absolute", top: 2, right: 2, width: 5, height: 5, borderRadius: "50%", background: T.accent }} />}
              </button>
            );
          })}
        </div>

        {/* Monatsüberschrift */}
        <div style={{ ...crd, background: isCurMonth ? T.accentL : T.card, borderColor: isCurMonth ? T.accent : T.border }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, color: isCurMonth ? T.accent : T.text }}>
              {isCurMonth ? "📌 " : ""}{MONATE_LANG[calMonth - 1]}
              {isCurMonth && <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8, color: T.muted }}>Aktueller Monat</span>}
            </h3>
            <button style={btn("s")} onClick={() => setEditKal({ id: null, pflanze_id: "", monat: calMonth, aufgabe: "", hinweis: "" })}>+ Aufgabe</button>
          </div>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div style={{ ...crd, textAlign: "center", color: T.muted, padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🌙</div>
            <div>Im {MONATE_LANG[calMonth - 1]} sind keine Pflegeaufgaben eingetragen.</div>
            <button style={{ ...btn("p"), marginTop: 12 }} onClick={() => setEditKal({ id: null, pflanze_id: "", monat: calMonth, aufgabe: "", hinweis: "" })}>Aufgabe hinzufügen</button>
          </div>
        ) : (
          Object.entries(grouped).map(([pflanzeId, tasks]) => {
            const p = plants.find(pl => pl.id === pflanzeId);
            if (!p) return null;
            const kat = KAT.find(k => k.id === p.kategorie);
            return (
              <div key={pflanzeId} style={crd}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 24 }}>{p.foto_emoji}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{kat?.emoji} {kat?.label} · #{p.nummer}</div>
                  </div>
                  <button style={{ ...btn("s"), marginLeft: "auto", fontSize: 12 }} onClick={() => { setSelectedId(p.id); setView("plant"); }}>Details →</button>
                </div>
                {tasks.map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "8px 10px", background: T.accentL, borderRadius: 8, marginBottom: 4 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>✅ {t.aufgabe}</div>
                      {t.hinweis && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{t.hinweis}</div>}
                    </div>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 14 }} onClick={() => setEditKal({ ...t })}>✏️</button>
                  </div>
                ))}
              </div>
            );
          })
        )}

        {/* Jahresübersicht kompakt */}
        <div style={{ ...crd, marginTop: 8 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, color: T.muted }}>Jahresübersicht – alle Pflanzen</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 6px", color: T.muted, whiteSpace: "nowrap" }}>Pflanze</th>
                  {MONATE.map((m, i) => (
                    <th key={i} style={{ padding: "4px 4px", color: i + 1 === curMonth() ? T.accent : T.muted, fontWeight: i + 1 === curMonth() ? 700 : 400, minWidth: 28, textAlign: "center" }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plants.map(p => {
                  const pKal = kalender.filter(k => k.pflanze_id === p.id);
                  if (pKal.length === 0) return null;
                  return (
                    <tr key={p.id}>
                      <td style={{ padding: "4px 6px", whiteSpace: "nowrap", fontWeight: 600 }}>{p.foto_emoji} {p.name}</td>
                      {MONATE.map((m, i) => {
                        const monthTasks = pKal.filter(k => k.monat === i + 1);
                        const isCur = i + 1 === curMonth();
                        return (
                          <td key={i} style={{ textAlign: "center", padding: "4px 2px" }}>
                            {monthTasks.length > 0 ? (
                              <div title={monthTasks.map(t => t.aufgabe).join(", ")}
                                style={{ width: 22, height: 22, borderRadius: "50%", background: isCur ? T.accent : T.accentL, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: isCur ? "#fff" : T.accent, fontWeight: 700, cursor: "pointer" }}
                                onClick={() => setCalMonth(i + 1)}>
                                {monthTasks.length}
                              </div>
                            ) : (
                              <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.bg, margin: "0 auto", border: `1px solid ${T.border}` }} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ─── Garden Map ───
  const MapView = () => {
    const [dragging, setDragging] = useState(null);
    const [positions, setPositions] = useState({});

    const getPos = (p) => positions[p.id] || { x: p.pos_x, y: p.pos_y };

    const handleDrop = async (e, p) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
      setPositions(prev => ({ ...prev, [p.id]: { x, y } }));
      await sb.from("pflanzen", token).update({ pos_x: x, pos_y: y }, `id=eq.${p.id}`);
    };

    return (
      <div>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>🗺️ Gartenplan</h2>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 10 }}>Pflanzen per Drag & Drop positionieren – Positionen werden automatisch gespeichert.</div>
        <div style={{ position: "relative", width: "100%", paddingBottom: "75%", background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)", borderRadius: 14, border: `2px solid ${T.border}`, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {/* Grid */}
            {[25, 50, 75].map(p => (
              <div key={p} style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 0, borderLeft: "1px dashed rgba(255,255,255,0.4)" }} />
            ))}
            {[25, 50, 75].map(p => (
              <div key={p} style={{ position: "absolute", top: `${p}%`, left: 0, right: 0, borderTop: "1px dashed rgba(255,255,255,0.4)" }} />
            ))}
            {/* Plants */}
            {plants.map(p => {
              const { x, y } = getPos(p);
              const kat = KAT.find(k => k.id === p.kategorie);
              return (
                <div key={p.id}
                  draggable
                  onDragEnd={(e) => handleDrop(e, p)}
                  onClick={() => { setSelectedId(p.id); setView("plant"); }}
                  style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", cursor: "grab", zIndex: 2 }}
                  title={p.name}
                >
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: kat?.color || T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.2)", border: "2px solid white" }}>
                      {p.foto_emoji}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#1a1a1a", background: "rgba(255,255,255,0.9)", borderRadius: 4, padding: "1px 3px", marginTop: 2, whiteSpace: "nowrap", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ─── DB View ───
  const DbView = () => (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input style={{ ...inp, flex: 1 }} placeholder="🔍 Name oder Nummer…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button style={{ ...btn(filterKat === "" ? "p" : ""), padding: "5px 10px", fontSize: 12 }} onClick={() => setFilterKat("")}>Alle</button>
        {KAT.map(k => (
          <button key={k.id} style={{ ...btn(filterKat === k.id ? "p" : ""), padding: "5px 10px", fontSize: 12 }} onClick={() => setFilterKat(k.id)}>
            {k.emoji} {k.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 && <div style={{ textAlign: "center", color: T.muted, padding: 32 }}>{plants.length === 0 ? "Noch keine Pflanzen angelegt." : "Keine Treffer."}</div>}
      {filtered.map(p => {
        const kat = KAT.find(k => k.id === p.kategorie);
        const pKalNow = kalender.filter(k => k.pflanze_id === p.id && k.monat === curMonth());
        return (
          <div key={p.id} style={{ ...crd, cursor: "pointer", transition: "box-shadow .15s" }}
            onClick={() => { setSelectedId(p.id); setView("plant"); }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28, width: 46, height: 46, borderRadius: 12, background: `${kat?.color || T.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.foto_emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  <span style={tag(kat?.color || T.accent, `${kat?.color || T.accent}15`)}>#{p.nummer}</span>
                </div>
                {p.art_botanisch && <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>{p.art_botanisch}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: T.muted }}>{kat?.emoji} {kat?.label}</span>
                  {p.standort && <span style={{ fontSize: 12, color: T.muted }}>· 📍 {p.standort}</span>}
                  {pKalNow.length > 0 && (
                    <span style={{ ...tag(T.warm, T.warmL), fontSize: 11 }}>⚠️ {pKalNow.length} Aufgabe{pKalNow.length > 1 ? "n" : ""} im {MONATE[curMonth() - 1]}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        <button style={btn("p")} onClick={() => {
          setEditData({ id: null, name: "", art_botanisch: "", kategorie: "zierpflanzen", standort: "", licht: "Sonne", boden: "Normal", foto_emoji: "🌱", nummer: (plants.length ? Math.max(...plants.map(p => p.nummer)) : 0) + 1, pos_x: 50, pos_y: 50, gepflanzt: "", notizen: "" });
        }}>+ Neue Pflanze</button>
      </div>
    </div>
  );

  // ─── Logbook View ───
  const LogView = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>🗒️ Logbuch</h2>
        <button style={btn("s")} onClick={() => setEditLog({ id: null, pflanze_id: "", typ: "pflege", datum: new Date().toISOString().split("T")[0], titel: "", beschreibung: "" })}>+ Eintrag</button>
      </div>
      {logEntries.length === 0 && <div style={{ textAlign: "center", color: T.muted, padding: 32 }}>Noch keine Einträge.</div>}
      {logEntries.map(l => {
        const p = plants.find(pl => pl.id === l.pflanze_id);
        return (
          <div key={l.id} style={crd}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={tag(l.typ === "pflege" ? T.accent : T.red, l.typ === "pflege" ? T.accentL : T.redL)}>{l.typ === "pflege" ? "🌿" : "🐛"}</span>
                  {p && <span style={{ fontSize: 13, fontWeight: 600 }}>{p.foto_emoji} {p.name}</span>}
                  <span style={{ fontSize: 12, color: T.muted }}>{l.datum}</span>
                </div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{l.titel}</div>
                {l.beschreibung && <div style={{ fontSize: 13, color: T.muted }}>{l.beschreibung}</div>}
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: T.muted }} onClick={() => setEditLog({ ...l })}>✏️</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─── Nav ───
  const navItems = [
    { id: "db", label: "🌱 Pflanzen" },
    { id: "calendar", label: "📅 Kalender" },
    { id: "logbook", label: "🗒️ Logbuch" },
    { id: "map", label: "🗺️ Karte" },
  ];

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: T.bg, minHeight: "100vh", color: T.text }}>
      {/* Header */}
      <div style={{ background: T.card, borderBottom: `1px solid ${T.border}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: T.accent }}>🌿 Gartenbuch</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.muted }}>{session.user.email}</span>
          <button style={{ ...btn("s"), fontSize: 12 }} onClick={async () => { await sb.auth.signOut(token); setSession(null); }}>Abmelden</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", background: T.card, borderBottom: `1px solid ${T.border}`, overflowX: "auto" }}>
        {navItems.map(n => (
          <button key={n.id} style={{ flex: 1, padding: "10px 8px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: view === n.id ? 700 : 400, color: view === n.id ? T.accent : T.muted, borderBottom: `2px solid ${view === n.id ? T.accent : "transparent"}`, whiteSpace: "nowrap" }}
            onClick={() => { setView(n.id); setSelectedId(null); }}>{n.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 12px 80px" }}>
        {msg && <div style={{ background: T.accentL, border: `1px solid ${T.accent}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>{msg}</div>}

        {view === "db" && !selectedId && <DbView />}
        {view === "db" && selectedId && <PlantView />}
        {view === "plant" && <PlantView />}
        {view === "logbook" && <LogView />}
        {view === "map" && <MapView />}
        {view === "calendar" && <CalendarView />}
      </div>

      {/* Modals */}
      {editData && <EditPlantModal />}
      {editLog && <EditLogModal />}
      {editKal && <EditKalModal />}
    </div>
  );
}

// ─── Modal Wrapper ───
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", padding: "20px 16px 32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
          <button style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888", padding: 4 }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Login Screen ───
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const T2 = { bg: "#faf9f7", card: "#fff", accent: "#5a7a3a", border: "#e8e3db", muted: "#9c8f80" };

  const login = async () => {
    setLoading(true); setError("");
    try {
      const session = await sb.auth.signIn(email, password);
      onLogin(session);
    } catch (e) { setError("Login fehlgeschlagen: " + e.message); }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: T2.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: T2.card, border: `1px solid ${T2.border}`, borderRadius: 16, padding: "32px 24px", width: "100%", maxWidth: 380, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>🌿</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T2.accent, margin: "8px 0 4px" }}>Gartenbuch</h1>
          <div style={{ fontSize: 13, color: T2.muted }}>Anmelden um fortzufahren</div>
        </div>
        {error && <div style={{ background: "#fef2f2", border: "1px solid #dc2626", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</div>}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T2.muted, textTransform: "uppercase", marginBottom: 4 }}>E-Mail</div>
          <input style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T2.border}`, fontSize: 14, background: T2.bg, boxSizing: "border-box" }}
            type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T2.muted, textTransform: "uppercase", marginBottom: 4 }}>Passwort</div>
          <input style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T2.border}`, fontSize: 14, background: T2.bg, boxSizing: "border-box" }}
            type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        </div>
        <button style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: T2.accent, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
          onClick={login} disabled={loading}>{loading ? "Anmelden…" : "Anmelden"}</button>
      </div>
    </div>
  );
}
