(function () {
  
  const MANIFEST_URL =
    "https://cdn.jsdelivr.net/gh/hiddenball/mlb-data-core@main/manifest.json";
  let manifestPromise = null;
  const jsonCache = new Map();
  function fetchJSON(url) {
    if (jsonCache.has(url)) return Promise.resolve(jsonCache.get(url));
    return fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
      return res.json();
    }).then((data) => {
      jsonCache.set(url, data);
      return data;
    });
  }
  function getManifest() {
    if (!manifestPromise) manifestPromise = fetchJSON(MANIFEST_URL);
    return manifestPromise;
  }
  function seasonBase(manifest, year) {
    const repoName = manifest.seasons[String(year)];
    if (repoName && manifest.season_repos[repoName]) {
      return manifest.season_repos[repoName];
    }
    return manifest.current.url;
  }
  function seasonFileURL(manifest, year, file) {
    return `${seasonBase(manifest, year)}/data/seasons/${year}/${file}`;
  }
  function coreFileURL(manifest, file) {
    return `${manifest.core.url}/${file}`;
  }
  function fetchSeasonFile(year, file) {
    return getManifest().then((m) => fetchJSON(seasonFileURL(m, year, file)));
  }
  function fetchCoreFile(file) {
    return getManifest().then((m) => fetchJSON(coreFileURL(m, file)));
  }
  function fetchYearRange(fromYear, toYear, file) {
    const years = [];
    for (let y = fromYear; y <= toYear; y++) years.push(y);
    return Promise.all(
      years.map((year) =>
        fetchSeasonFile(year, file)
          .then((data) => ({ year, data }))
          .catch(() => null)
      )
    ).then((rows) => rows.filter(Boolean));
  }
  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
  const teamNameCache = new Map();
  function fetchTeamName(id) {
    if (id == null) return Promise.resolve(null);
    if (teamNameCache.has(id)) return Promise.resolve(teamNameCache.get(id));
    return fetchCoreFile(`teams/${id}.json`)
      .then((t) => {
        teamNameCache.set(id, t.currentName);
        return t.currentName;
      })
      .catch(() => `Team ${id}`);
  }
  function pick(obj, keys, fallback) {
    for (const k of keys) if (obj && obj[k] != null) return obj[k];
    return fallback === undefined ? null : fallback;
  }
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else node.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }
  function fmtAvg(hits, atBats) {
    if (!atBats) return ".---";
    return (hits / atBats).toFixed(3).replace(/^0/, "");
  }
  function fmtERA(er, ip) {
    const outs = ipToOuts(ip);
    if (!outs) return "-.--";
    return ((er * 27) / outs).toFixed(2);
  }
  function ipToOuts(ip) {
    if (ip == null) return 0;
    const [whole, frac] = String(ip).split(".");
    return Number(whole || 0) * 3 + Number(frac || 0);
  }
  window.MLB = {
    getManifest,
    seasonBase,
    seasonFileURL,
    coreFileURL,
    fetchSeasonFile,
    fetchCoreFile,
    fetchYearRange,
    fetchJSON,
    qs,
    el,
    fmtAvg,
    fmtERA,
    ipToOuts,
    fetchTeamName,
    pick,
  };
})();
