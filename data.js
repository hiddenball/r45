/* ==========================================================================
   MLB Archive — shared data layer
   Fetches manifest.json once per session and builds CDN URLs from it.
   Every other page (team.html, player.html, and future pages) should
   include this file and use window.MLB.* rather than hardcoding URLs.
   ========================================================================== */

(function () {
  const MANIFEST_URL =
    "https://cdn.jsdelivr.net/gh/hiddenball/mlb-data-core@main/manifest.json";

  let manifestPromise = null;
  const jsonCache = new Map(); // url -> parsed JSON, in-memory for this page load

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

  // Resolve the base CDN URL for a given season, using the manifest's
  // seasons -> season_repos map, falling back to the "current" repo for
  // any year not yet assigned to a frozen season repo.
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

  // Fetch the same file across an inclusive year range, in parallel.
  // Returns [{ year, data }] for years that resolved; failures are
  // dropped (a season repo can legitimately lack a file for a given team).
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

  // Small render helpers shared across pages.
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

  // innings pitched is stored like "182.1" meaning 182 innings + 1 out
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
  };
})();
