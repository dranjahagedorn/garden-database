// ════════════════════════════════════════════════════════════
// GARTEN-APP v2 – React + Supabase
// Features: Login, Pflanzendatenbank, Logbuch, Gartenplan,
//           QR-Codes, Pflegekalender (Monatsansicht)
// ════════════════════════════════════════════════════════════
// ⚠️  HIER DEINE SUPABASE-DATEN EINTRAGEN:
const SUPABASE_URL = "https://rzdyughiamhbbdqfqzil.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6ZHl1Z2hpYW1oYmJkcWZxemlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTU1MzksImV4cCI6MjA5MzI5MTUzOX0.9MG3bbo2w4krlp5BaCwEdJCr_naCffBVrWVLIlMPPX0";
const WU_API_KEY = "d32c9fca0e064133ac9fca0e06613363";
const WU_STATION = "IMULDE36";
// ════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from "react";

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

// ─── External Modal Components (outside App to prevent remount on re-render) ───
function EditPlantModal({ editData, setEditData, savePlant, deletePlant, loading }) {
  if (!editData) return null;
  return (
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
          <div style={lbl}>Gießbedarf</div>
          <select style={inp} value={editData.giess_bedarf || ""} onChange={e => setEditData({ ...editData, giess_bedarf: e.target.value })}>
            <option value="">–</option>
            {["Gering", "Mittel", "Hoch"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={lbl}>Düngebedarf</div>
          <select style={inp} value={editData.duenge_bedarf || ""} onChange={e => setEditData({ ...editData, duenge_bedarf: e.target.value })}>
            <option value="">–</option>
            {["Gering", "Mittel", "Hoch"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <div style={lbl}>Schnitt</div>
          <select style={inp} value={editData.schnitt || ""} onChange={e => setEditData({ ...editData, schnitt: e.target.value })}>
            <option value="">–</option>
            {["Keiner", "Frühjahr", "Sommer", "Herbst", "Nach Blüte"].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={lbl}>Gepflanzt</div>
      <input style={inp} value={editData.gepflanzt} onChange={e => setEditData({ ...editData, gepflanzt: e.target.value })} placeholder="z.B. Frühjahr 2023" />
      <div style={lbl}>Foto</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {editData.foto_url && <img src={editData.foto_url} alt="Pflanzenfoto" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.border}` }} />}
        <label style={{ ...btn(), display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
          📷 {editData.foto_url ? "Foto ändern" : "Foto hochladen"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => setEditData({ ...editData, foto_url: ev.target.result });
            reader.readAsDataURL(file);
          }} />
        </label>
        {editData.foto_url && <button style={{ ...btn("d"), fontSize: 12, padding: "5px 10px" }} onClick={() => setEditData({ ...editData, foto_url: "" })}>Foto entfernen</button>}
      </div>
      <div style={lbl}>Notizen</div>
      <textarea style={{ ...inp, height: 80, resize: "vertical" }} value={editData.notizen} onChange={e => setEditData({ ...editData, notizen: e.target.value })} />
      <div style={lbl}>Foto</div>
      {editData.foto_url && (
        <img src={editData.foto_url} alt="Pflanzenfoto" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8, marginBottom: 8, border: `1px solid ${T.border}` }} />
      )}
      <label style={{ ...btn(), display: "block", textAlign: "center", cursor: "pointer" }}>
        📷 {editData.foto_url ? "Foto ändern" : "Foto hochladen"}
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => setEditData({ ...editData, _fotoFile: e.target.files[0], foto_preview: URL.createObjectURL(e.target.files[0]) })} />
      </label>
      {editData._fotoFile && (
        <img src={editData.foto_preview} alt="Vorschau" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8, marginTop: 8, border: `1px solid ${T.accent}` }} />
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button style={btn("p")} onClick={savePlant} disabled={loading}>{loading ? "…" : "Speichern"}</button>
        <button style={btn()} onClick={() => setEditData(null)}>Abbrechen</button>
        {editData.id && <button style={{ ...btn("d"), marginLeft: "auto" }} onClick={() => deletePlant(editData.id)}>Löschen</button>}
      </div>
    </Modal>
  );
}

function EditLogModal({ editLog, setEditLog, saveLog, deleteLog, loading, plants }) {
  if (!editLog) return null;
  return (
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
}

function EditKalModal({ editKal, setEditKal, saveKal, deleteKal, loading, plants }) {
  if (!editKal) return null;
  return (
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
}


// ─── Weather View ───
function WeatherView() {
  const [wx, setWx] = useState(null);
  const [history, setHistory] = useState([]); // letzte 5 Tage
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      // Aktuell
      const proxyUrl = `${SUPABASE_URL}/functions/v1/wu-proxy`;
      const proxyHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` };

      const res = await fetch(proxyUrl, { method: "POST", headers: proxyHeaders, body: JSON.stringify({ stationId: WU_STATION }) });
      if (!res.ok) throw new Error("Abruf fehlgeschlagen");
      const data = await res.json();
      setWx(data.observations[0]);

      // History: letzte 5 Tage als Tagessummen
      const hist = [];
      for (let i = 1; i <= 5; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
        try {
          const r = await fetch(proxyUrl, { method: "POST", headers: proxyHeaders, body: JSON.stringify({ stationId: WU_STATION, date: dateStr }) });
          const hd = await r.json();
          if (hd.observations?.[0]) {
            hist.push({ date: d, precip: hd.observations[0].metric.precipTotal || 0, tempHigh: hd.observations[0].metric.tempHigh, tempAvg: hd.observations[0].metric.tempAvg });
          }
        } catch (_) {}
      }
      setHistory(hist);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); const iv = setInterval(load, 10 * 60 * 1000); return () => clearInterval(iv); }, []);

  const windDir = (deg) => ["N","NO","O","SO","S","SW","W","NW"][Math.round(deg / 45) % 8];

  // ─── Gießempfehlung ───
  const giessEmpfehlung = () => {
    if (!wx || history.length < 2) return null;
    const m = wx.metric;
    const now = new Date();
    const hour = now.getHours();

    const regenLetzt3 = history.slice(0, 3).reduce((s, d) => s + d.precip, 0);
    const regenLetzt5 = history.reduce((s, d) => s + d.precip, 0);
    const heutePrecip = m.precipTotal || 0;
    const gesamtRegen = regenLetzt3 + heutePrecip;
    const temp = m.temp;
    const solar = wx.solarRadiation || 0;

    // Verdunstungsschätzung: grob 2–5mm/Tag je nach Temp + Sonne
    const verdunstungProTag = Math.max(1, (temp * 0.15 + solar * 0.003));
    const wasserDefizit = verdunstungProTag * 3 - gesamtRegen;

    let empfehlung = { text: "", detail: "", color: "", emoji: "" };

    if (heutePrecip > 8) {
      empfehlung = { emoji: "✅", color: "#16a34a", text: "Heute ausreichend geregnet", detail: `${heutePrecip.toFixed(1)} mm heute – kein Gießen nötig` };
    } else if (gesamtRegen > 15) {
      empfehlung = { emoji: "✅", color: "#16a34a", text: "Letzte Tage gut bewässert", detail: `${gesamtRegen.toFixed(1)} mm in den letzten 3 Tagen` };
    } else if (wasserDefizit > 8) {
      // Wann ist der beste Zeitpunkt?
      let zeitTipp = "";
      if (hour < 10) zeitTipp = "Jetzt ist ein guter Zeitpunkt – kühle Morgenstunden";
      else if (hour < 17) zeitTipp = "Besser warten bis nach 18 Uhr – weniger Verdunstung";
      else zeitTipp = "Guter Zeitpunkt – kühler Abend, wenig Verdunstung";
      empfehlung = { emoji: "🚿", color: "#c4773a", text: "Gießen empfohlen", detail: `Nur ${gesamtRegen.toFixed(1)} mm in 3 Tagen, geschätztes Defizit ${wasserDefizit.toFixed(0)} mm. ${zeitTipp}.` };
    } else if (wasserDefizit > 3) {
      empfehlung = { emoji: "⚠️", color: "#ca8a04", text: "Bald gießen", detail: `${gesamtRegen.toFixed(1)} mm in 3 Tagen – bei anhaltender Trockenheit morgen gießen` };
    } else {
      empfehlung = { emoji: "🌱", color: "#5a7a3a", text: "Wasserhaushalt ausgeglichen", detail: `${gesamtRegen.toFixed(1)} mm Regen in den letzten 3 Tagen` };
    }
    return empfehlung;
  };

  const T2 = { bg: "#faf9f7", card: "#ffffff", border: "#e8e3db", muted: "#9c8f80", text: "#2d2416", accent: "#5a7a3a", accentL: "#eef3e8", warm: "#c4773a", warmL: "#fdf4ec" };
  const lbl2 = { fontSize: 11, fontWeight: 700, color: T2.muted, textTransform: "uppercase", letterSpacing: .5, marginBottom: 2 };
  const crd2 = { background: T2.card, border: `1px solid ${T2.border}`, borderRadius: 14, padding: "16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };

  if (loading) return <div style={{ textAlign: "center", padding: 48, color: T2.muted }}>🌤️ Wetterdaten laden…</div>;
  if (error) return (
    <div style={{ ...crd2, color: "#dc2626" }}>❌ {error}
      <button style={{ marginLeft: 12, padding: "4px 12px", borderRadius: 8, border: "none", background: T2.accentL, color: T2.accent, cursor: "pointer", fontWeight: 600 }} onClick={load}>Erneut versuchen</button>
    </div>
  );
  if (!wx) return null;

  const m = wx.metric;
  const obsTime = new Date(wx.obsTimeLocal).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const obsDate = new Date(wx.obsTimeLocal).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const tempIcon = m.temp > 28 ? "☀️" : m.temp > 18 ? "🌤️" : m.temp > 8 ? "⛅" : m.temp > 0 ? "🌥️" : "❄️";
  const empf = giessEmpfehlung();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>🌤️ Wetter</h2>
        <div style={{ fontSize: 12, color: T2.muted, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{WU_STATION} · {obsDate}, {obsTime}</span>
          <button style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: T2.accentL, color: T2.accent, cursor: "pointer", fontWeight: 600, fontSize: 11 }} onClick={load}>↻</button>
        </div>
      </div>

      {/* Gießempfehlung – prominent oben */}
      {empf && (
        <div style={{ ...crd2, background: `${empf.color}12`, borderColor: `${empf.color}40`, borderWidth: 2 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ fontSize: 32 }}>{empf.emoji}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: empf.color }}>{empf.text}</div>
              <div style={{ fontSize: 13, color: T2.text, marginTop: 3, lineHeight: 1.4 }}>{empf.detail}</div>
            </div>
          </div>
          {/* Mini-Regenhistorie */}
          {history.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "flex-end" }}>
              {[...history].reverse().map((d, i) => {
                const maxPrecip = Math.max(...history.map(h => h.precip), 1);
                const h = Math.max(4, (d.precip / maxPrecip) * 40);
                return (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: T2.muted, marginBottom: 2 }}>{d.precip.toFixed(1)}</div>
                    <div style={{ height: h, background: d.precip > 5 ? "#3b82f6" : d.precip > 0 ? "#93c5fd" : T2.border, borderRadius: 3 }} />
                    <div style={{ fontSize: 10, color: T2.muted, marginTop: 2 }}>
                      {d.date.toLocaleDateString("de-DE", { weekday: "short" })}
                    </div>
                  </div>
                );
              })}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T2.muted, marginBottom: 2 }}>{(m.precipTotal || 0).toFixed(1)}</div>
                <div style={{ height: Math.max(4, ((m.precipTotal||0) / Math.max(...history.map(h => h.precip), 1)) * 40), background: (m.precipTotal||0) > 5 ? "#3b82f6" : (m.precipTotal||0) > 0 ? "#93c5fd" : T2.border, borderRadius: 3 }} />
                <div style={{ fontSize: 10, color: T2.accent, fontWeight: 700, marginTop: 2 }}>Heute</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Haupttemperatur */}
      <div style={{ ...crd2, background: `linear-gradient(135deg, ${T2.accentL} 0%, #fff 100%)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 48 }}>{tempIcon}</div>
          <div>
            <div style={{ fontSize: 44, fontWeight: 800, color: T2.text, lineHeight: 1 }}>{m.temp?.toFixed(1)}°</div>
            <div style={{ fontSize: 13, color: T2.muted }}>Gefühlt {(m.heatIndex ?? m.windChill ?? m.temp)?.toFixed(1)}°</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 13, color: T2.muted }}>Luftfeuchte</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{wx.humidity}%</div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={crd2}>
          <div style={lbl2}>💨 Wind</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{m.windSpeed?.toFixed(1)} km/h</div>
          <div style={{ fontSize: 12, color: T2.muted }}>{windDir(wx.winddir)} · Böen {m.windGust?.toFixed(1)} km/h</div>
        </div>
        <div style={crd2}>
          <div style={lbl2}>🌧️ Niederschlag</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{m.precipRate?.toFixed(1)} mm/h</div>
          <div style={{ fontSize: 12, color: T2.muted }}>Heute: {(m.precipTotal||0).toFixed(1)} mm</div>
        </div>
        <div style={crd2}>
          <div style={lbl2}>🌡️ Taupunkt</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{m.dewpt?.toFixed(1)}°C</div>
          <div style={{ fontSize: 12, color: T2.muted }}>{m.pressure?.toFixed(0)} hPa</div>
        </div>
        <div style={crd2}>
          <div style={lbl2}>☀️ Einstrahlung</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{wx.solarRadiation?.toFixed(0)} W/m²</div>
          <div style={{ fontSize: 12, color: T2.muted }}>UV {wx.uv?.toFixed(0)}</div>
        </div>
      </div>

      {/* Weitere Gartentipps */}
      {(() => {
        const tips = [];
        if (m.windSpeed > 30) tips.push("💨 Zu windig zum Sprühen oder Düngen");
        if (wx.uv > 6) tips.push("☀️ UV hoch – empfindliche Pflanzen schützen");
        if (m.temp < 4) tips.push("🥶 Frostgefahr – empfindliche Pflanzen abdecken");
        if (m.temp > 30) tips.push("🌡️ Hitzestress möglich – Mulchen hilft");
        if (tips.length === 0) return null;
        return (
          <div style={{ ...crd2, background: T2.warmL, borderColor: T2.warm }}>
            <div style={lbl2}>🌱 Weitere Tipps</div>
            {tips.map((t, i) => <div key={i} style={{ fontSize: 13, marginTop: 4 }}>{t}</div>)}
          </div>
        );
      })()}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState("weather"); // weather | db | plant | logbook | map | calendar
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

  // ─── QR Deep-Link: ?pflanze=X ───
  useEffect(() => {
    if (!token || plants.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const nummer = params.get("pflanze");
    if (!nummer) return;
    const plant = plants.find(p => String(p.nummer) === String(nummer));
    if (plant) {
      setSelectedId(plant.id);
      setView("db");
      // Clean URL ohne Parameter
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [token, plants]);

  // ─── Plant CRUD ───
  const savePlant = async () => {
    setLoading(true);
    try {
      // Foto hochladen falls vorhanden
      let foto_url = editData.foto_url || null;
      if (editData._fotoFile) {
        const ext = editData._fotoFile.name.split(".").pop();
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        foto_url = await sb.storage.upload(token, "pflanzfotos", path, editData._fotoFile);
      }
      // _fotoFile und foto_preview nicht in DB speichern
      const { _fotoFile, foto_preview, ...data } = { ...editData, foto_url };

      if (data.id) {
        const { id, user_id, created_at, ...rest } = data;
        await sb.from("pflanzen", token).update(rest, `id=eq.${id}`);
        await loadPlants();
        setEditData(null); notify("✅ Pflanze gespeichert");
      } else {
        const { id, ...rest } = data;
        const result = await sb.from("pflanzen", token).insert({ ...rest, user_id: session.user.id });
        await loadPlants();
        const newPlant = Array.isArray(result) ? result[0] : null;
        if (newPlant) { setSelectedId(newPlant.id); setView("db"); }
        else setView("db");
        setEditData(null); notify("✅ Pflanze angelegt – QR-Code unten verfügbar");
      }
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
  const qrBaseUrl = () => window.location.origin + window.location.pathname;
  const qrUrl = (p) => `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrBaseUrl() + "?pflanze=" + p.nummer)}`;

  const downloadQR = async (p) => {
    const url = qrUrl(p);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const pad = 20;
      const fontSize = 16;
      canvas.width = img.width + pad * 2;
      canvas.height = img.height + pad * 2 + fontSize + 8;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, pad, pad);
      ctx.fillStyle = "#2d2416";
      ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`#${p.nummer} ${p.name}`, canvas.width / 2, img.height + pad + fontSize + 4);
      const a = document.createElement("a");
      a.download = `QR_${p.nummer}_${p.name.replace(/\s+/g, "_")}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  };

  // ─── Login Screen ───
  if (!session) return <LoginScreen onLogin={setSession} />;

  // ─── Filtered Plants ───
  const filtered = plants.filter(p =>
    (!filterKat || p.kategorie === filterKat) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || String(p.nummer).includes(search))
  );

  // ─── Modals (defined externally to prevent focus loss on re-render) ───

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
            <div><div style={lbl}>Gießbedarf</div><div style={{ fontSize: 14 }}>{p.giess_bedarf || "–"}</div></div>
            <div><div style={lbl}>Düngebedarf</div><div style={{ fontSize: 14 }}>{p.duenge_bedarf || "–"}</div></div>
            <div><div style={lbl}>Schnitt</div><div style={{ fontSize: 14 }}>{p.schnitt || "–"}</div></div>
          </div>
          {p.foto_url && <><div style={lbl}>Foto</div><img src={p.foto_url} alt="Pflanzenfoto" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 10, border: `1px solid ${T.border}` }} /></>}
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
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
            <img src={qrUrl(p)} alt="QR" style={{ width: 100, height: 100, borderRadius: 8, border: `1px solid ${T.border}` }} />
            <button style={btn("w")} onClick={() => downloadQR(p)}>⬇️ QR herunterladen</button>
          </div>

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

  // ─── Garden Map (Leaflet + DOP20 ImageOverlay) ───
  const MapView = () => {
    const mapRef = useRef(null);
    const leafletMap = useRef(null);
    const markersRef = useRef({});
    const [mapReady, setMapReady] = useState(false);
    const [imageUrl, setImageUrl] = useState(() => localStorage.getItem("garten_img_url") || "");
    const [inputUrl, setInputUrl] = useState(() => localStorage.getItem("garten_img_url") || "");
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [selectedPlant, setSelectedPlant] = useState(null);

    // Leaflet laden (CDN)
    useEffect(() => {
      if (window.L) { setMapReady(true); return; }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setMapReady(true);
      document.head.appendChild(script);
    }, []);

    // Karte initialisieren
    useEffect(() => {
      if (!mapReady || !mapRef.current || leafletMap.current) return;
      const L = window.L;

      // Gartenkoordinaten (aus DOP20 garten.tif)
      const GARTEN_BOUNDS = [[51.65162778, 12.41740556], [51.65371944, 12.42016389]];

      const map = L.map(mapRef.current, {
        maxZoom: 21,
        minZoom: 16,
        zoomSnap: 0.5,
        attributionControl: false,
      });

      // Kein Tile-Layer – nur das eigene Luftbild
      if (imageUrl) {
        L.imageOverlay(imageUrl, GARTEN_BOUNDS, { opacity: 1, interactive: false }).addTo(map);
        map.fitBounds(GARTEN_BOUNDS, { padding: [10, 10] });
        map.setMaxBounds([[GARTEN_BOUNDS[0][0] - 0.001, GARTEN_BOUNDS[0][1] - 0.001],
                          [GARTEN_BOUNDS[1][0] + 0.001, GARTEN_BOUNDS[1][1] + 0.001]]);
      } else {
        map.setView([51.65267361, 12.41878472], 18);
      }

      leafletMap.current = map;
    }, [mapReady, imageUrl]);

    // Marker aktualisieren – OHNE Zoom zurückzusetzen
    useEffect(() => {
      if (!leafletMap.current || !mapReady) return;
      const L = window.L;
      const map = leafletMap.current;

      // Alte Marker entfernen
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};

      // Neue Marker – größer für bessere Bedienbarkeit
      plants.forEach(p => {
        if (!p.pos_lat || !p.pos_lng) return;
        const kat = KAT.find(k => k.id === p.kategorie);
        const color = kat?.color || "#5a7a3a";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer">${p.foto_emoji}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const marker = L.marker([p.pos_lat, p.pos_lng], { icon, draggable: true });
        marker.on("click", () => setSelectedPlant(p));
        // dragend: Position speichern ohne Zoom-Reset
        marker.on("dragend", async (e) => {
          const { lat, lng } = e.target.getLatLng();
          await sb.from("pflanzen", token).update({ pos_lat: lat, pos_lng: lng }, `id=eq.${p.id}`);
          // loadPlants() würde Marker neu setzen → kein await nötig, nur stille DB-Aktualisierung
          notify("📍 Position gespeichert");
        });
        marker.addTo(map);
        markersRef.current[p.id] = marker;
      });

      // Klick auf leere Kartenfläche → Pflanze ohne Position setzen
      map.off("click");
      map.on("click", (e) => {
        // Nur wenn kein Marker geklickt wurde
        const ohnePos = plants.find(p => !p.pos_lat && !p.pos_lng);
        if (ohnePos) {
          setSelectedPlant({ ...ohnePos, _setPos: e.latlng });
        }
      });
    }, [plants, mapReady]);

    // Position setzen wenn _setPos vorhanden – ohne loadPlants (kein Zoom-Reset!)
    useEffect(() => {
      if (!selectedPlant?._setPos) return;
      const { lat, lng } = selectedPlant._setPos;
      const p = selectedPlant;
      (async () => {
        await sb.from("pflanzen", token).update({ pos_lat: lat, pos_lng: lng }, `id=eq.${p.id}`);
        // Marker direkt auf Karte setzen ohne loadPlants
        const L = window.L;
        const map = leafletMap.current;
        if (map) {
          const kat = KAT.find(k => k.id === p.kategorie);
          const color = kat?.color || "#5a7a3a";
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer">${p.foto_emoji}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          const marker = L.marker([lat, lng], { icon, draggable: true });
          marker.on("click", () => setSelectedPlant({ ...p, pos_lat: lat, pos_lng: lng }));
          marker.on("dragend", async (e2) => {
            const pos = e2.target.getLatLng();
            await sb.from("pflanzen", token).update({ pos_lat: pos.lat, pos_lng: pos.lng }, `id=eq.${p.id}`);
            notify("📍 Position gespeichert");
          });
          marker.addTo(map);
          markersRef.current[p.id] = marker;
        }
        // Plants im Hintergrund neu laden
        loadPlants();
        notify(`📍 ${p.name} positioniert`);
        setSelectedPlant(null);
        // Direkt zum Steckbrief navigieren
        setSelectedId(p.id);
        setView("plant");
      })();
    }, [selectedPlant]);

    const saveImageUrl = () => {
      localStorage.setItem("garten_img_url", inputUrl);
      setShowUrlInput(false);
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
      setImageUrl(inputUrl);
      notify("✅ Luftbild geladen");
    };

    const ohnePos = plants.filter(p => !p.pos_lat && !p.pos_lng);
    const mitPos = plants.filter(p => p.pos_lat && p.pos_lng).sort((a, b) => a.nummer - b.nummer);

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>🗺️ Gartenplan</h2>
          <button style={{ ...btn("s"), fontSize: 12 }} onClick={() => setShowUrlInput(v => !v)}>
            {imageUrl ? "🖼️ Bild ändern" : "🖼️ Luftbild laden"}
          </button>
        </div>

        {/* URL-Eingabe */}
        {showUrlInput && (
          <div style={{ ...crd, marginBottom: 10 }}>
            <div style={lbl}>Supabase Storage URL (PNG/JPEG)</div>
            <input style={inp} value={inputUrl} onChange={e => setInputUrl(e.target.value)}
              placeholder="https://xxx.supabase.co/storage/v1/object/public/karte/garten.png" />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={btn("p")} onClick={saveImageUrl}>Speichern & laden</button>
              <button style={btn()} onClick={() => setShowUrlInput(false)}>Abbrechen</button>
            </div>
          </div>
        )}

        {/* Hinweis wenn keine Position zu setzen */}
        {ohnePos.length > 0 && (
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>
            → Auf Karte klicken um <strong>{ohnePos[0].foto_emoji} {ohnePos[0].name}</strong> zu positionieren
          </div>
        )}

        {/* Karte + Seitenleiste */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 10, alignItems: "start" }}>
          {/* Karte */}
          {!mapReady ? (
            <div style={{ height: 480, borderRadius: 14, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.muted }}>
              Karte wird geladen…
            </div>
          ) : (
            <div ref={mapRef} style={{ height: 480, borderRadius: 14, border: `2px solid ${T.border}`, overflow: "hidden", zIndex: 0 }} />
          )}

          {/* Seitenleiste – Pflanzenliste nach Nummer */}
          <div style={{ ...crd, marginBottom: 0, maxHeight: 480, overflowY: "auto" }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: T.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Pflanzen</div>
            {mitPos.map(p => {
              const kat = KAT.find(k => k.id === p.kategorie);
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
                  onClick={() => { setSelectedId(p.id); setView("plant"); }}>
                  <span style={{ fontSize: 16 }}>{p.foto_emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>#{p.nummer}</div>
                  </div>
                </div>
              );
            })}
            {ohnePos.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 8, marginBottom: 4, fontWeight: 700 }}>Ohne Position:</div>
                {ohnePos.map(p => (
                  <div key={p.id} style={{ fontSize: 12, color: T.muted, padding: "3px 0" }}>{p.foto_emoji} {p.name}</div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Pflanze angeklickt → Popup unten */}
        {selectedPlant && !selectedPlant._setPos && (
          <div style={{ ...crd, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><strong>{selectedPlant.foto_emoji} {selectedPlant.name}</strong> · #{selectedPlant.nummer}</div>
              <button style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }} onClick={() => setSelectedPlant(null)}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={btn("p")} onClick={() => { setSelectedId(selectedPlant.id); setView("plant"); }}>Details →</button>
              <button style={btn("d")} onClick={async () => {
                if (!confirm("Position löschen?")) return;
                if (markersRef.current[selectedPlant.id]) {
                  markersRef.current[selectedPlant.id].remove();
                  delete markersRef.current[selectedPlant.id];
                }
                await sb.from("pflanzen", token).update({ pos_lat: null, pos_lng: null }, `id=eq.${selectedPlant.id}`);
                loadPlants();
                setSelectedPlant(null);
              }}>📍 Position entfernen</button>
            </div>
          </div>
        )}
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
          setEditData({ id: null, name: "", art_botanisch: "", kategorie: "zierpflanzen", standort: "", licht: "Sonne", giess_bedarf: "", duenge_bedarf: "", schnitt: "", foto_emoji: "🌱", foto_url: "", nummer: (plants.length ? Math.max(...plants.map(p => p.nummer)) : 0) + 1, pos_x: 50, pos_y: 50, gepflanzt: "", notizen: "" });
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
    { id: "weather", label: "🌤️ Wetter" },
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
        {view === "weather" && <WeatherView />}
      </div>

      {/* Modals */}
      <EditPlantModal editData={editData} setEditData={setEditData} savePlant={savePlant} deletePlant={deletePlant} loading={loading} />
      <EditLogModal editLog={editLog} setEditLog={setEditLog} saveLog={saveLog} deleteLog={deleteLog} loading={loading} plants={plants} />
      <EditKalModal editKal={editKal} setEditKal={setEditKal} saveKal={saveKal} deleteKal={deleteKal} loading={loading} plants={plants} />
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
