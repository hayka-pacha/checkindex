/**
 * Dashboard HTML — self-contained single-page app served inline.
 * No build tools, no framework dependencies. Just HTML + CSS + vanilla JS.
 *
 * Note: innerHTML is used with escapeHtml() for all user-supplied content.
 * All domain strings are escaped before insertion into the DOM.
 */

export const dashboardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>checkindex — Google Indexation Checker</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #212529; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .subtitle { color: #6c757d; margin-bottom: 2rem; font-size: 0.9rem; }
    .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { font-size: 1.1rem; margin-bottom: 1rem; }
    .form-row { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
    input[type="text"], textarea { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #dee2e6; border-radius: 4px; font-size: 0.9rem; font-family: inherit; }
    textarea { min-height: 80px; resize: vertical; }
    button { padding: 0.5rem 1.25rem; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: 500; }
    .btn-primary { background: #0d6efd; color: white; }
    .btn-primary:hover { background: #0b5ed7; }
    .btn-primary:disabled { background: #6c757d; cursor: not-allowed; }
    .signals-toggle { background: none; border: none; color: #0d6efd; cursor: pointer; font-size: 0.85rem; padding: 0; margin-bottom: 0.75rem; }
    .signals-panel { display: none; margin-bottom: 0.75rem; }
    .signals-panel.open { display: block; }
    .signals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .signals-grid label { font-size: 0.8rem; color: #6c757d; }
    .signals-grid input { width: 100%; padding: 0.4rem 0.6rem; border: 1px solid #dee2e6; border-radius: 4px; font-size: 0.85rem; }
    .result { padding: 1rem; border-radius: 6px; margin-top: 0.75rem; }
    .result.indexed { background: #d1e7dd; border: 1px solid #badbcc; }
    .result.not-indexed { background: #f8d7da; border: 1px solid #f5c2c7; }
    .result.error { background: #fff3cd; border: 1px solid #ffecb5; }
    .result .domain { font-weight: 600; }
    .result .meta { font-size: 0.85rem; color: #495057; margin-top: 0.25rem; }
    .loading { display: none; color: #6c757d; padding: 0.75rem 0; }
    .loading.active { display: block; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.85rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; font-weight: 600; font-size: 0.8rem; color: #6c757d; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.75rem; font-weight: 500; }
    .badge-yes { background: #d1e7dd; color: #0f5132; }
    .badge-no { background: #f8d7da; color: #842029; }
    .badge-high { background: #cfe2ff; color: #084298; }
    .badge-medium { background: #fff3cd; color: #664d03; }
    .badge-low { background: #e2e3e5; color: #41464b; }
    .badge-cached { background: #e2e3e5; color: #41464b; font-size: 0.7rem; }
    .history-section { margin-top: 1rem; }
    .history-section h3 { font-size: 0.95rem; margin-bottom: 0.5rem; color: #495057; }
    .tabs { display: flex; gap: 0; margin-bottom: 1rem; }
    .tab { padding: 0.5rem 1rem; border: 1px solid #dee2e6; background: #f8f9fa; cursor: pointer; font-size: 0.9rem; }
    .tab:first-child { border-radius: 4px 0 0 4px; }
    .tab:last-child { border-radius: 0 4px 4px 0; }
    .tab.active { background: white; border-bottom-color: white; font-weight: 500; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    @media (max-width: 600px) { .signals-grid { grid-template-columns: 1fr; } .form-row { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>checkindex</h1>
    <p class="subtitle">Google indexation checker — verify if domains are indexed</p>

    <div class="tabs">
      <div class="tab active" data-tab="single">Single Check</div>
      <div class="tab" data-tab="batch">Batch Check</div>
    </div>

    <div id="tab-single" class="tab-content active">
      <div class="card">
        <h2>Check a Domain</h2>
        <div class="form-row">
          <input type="text" id="domain-input" placeholder="example.com or https://example.com/page" />
          <button class="btn-primary" id="check-btn">Check</button>
        </div>
        <button class="signals-toggle" id="signals-toggle">+ SEO Signals (optional)</button>
        <div class="signals-panel" id="signals-panel">
          <div class="signals-grid">
            <div><label>Keywords Top 100</label><input type="number" id="sig-keywords" min="0" placeholder="0" /></div>
            <div><label>Traffic</label><input type="number" id="sig-traffic" min="0" placeholder="0" /></div>
            <div><label>Backlinks</label><input type="number" id="sig-backlinks" min="0" placeholder="0" /></div>
            <div><label>Domain Age (years)</label><input type="number" id="sig-age" min="0" step="0.1" placeholder="0" /></div>
          </div>
        </div>
        <div class="loading" id="single-loading">Checking...</div>
        <div id="single-result"></div>
      </div>
    </div>

    <div id="tab-batch" class="tab-content">
      <div class="card">
        <h2>Batch Check</h2>
        <textarea id="batch-input" placeholder="Enter domains, one per line (max 50)&#10;example.com&#10;github.com&#10;expired-domain.xyz"></textarea>
        <div class="form-row" style="margin-top:0.75rem">
          <button class="btn-primary" id="batch-btn">Check All</button>
          <span style="font-size:0.8rem;color:#6c757d;align-self:center" id="batch-count"></span>
        </div>
        <div class="loading" id="batch-loading">Processing batch...</div>
        <div id="batch-result"></div>
      </div>
    </div>

    <div class="history-section" id="history-section" style="display:none">
      <div class="card">
        <h3>Recent Checks</h3>
        <table>
          <thead><tr><th>Domain</th><th>Status</th><th>Confidence</th><th>Method</th></tr></thead>
          <tbody id="history-body"></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    /* All user-supplied strings are escaped via escapeHtml() before DOM insertion */
    const history = [];

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    // Tabs
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(tc) { tc.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Signals toggle
    document.getElementById('signals-toggle').addEventListener('click', function() {
      var panel = document.getElementById('signals-panel');
      panel.classList.toggle('open');
      document.getElementById('signals-toggle').textContent = panel.classList.contains('open') ? '- SEO Signals' : '+ SEO Signals (optional)';
    });

    // Single check
    document.getElementById('check-btn').addEventListener('click', doSingleCheck);
    document.getElementById('domain-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') doSingleCheck(); });

    async function doSingleCheck() {
      var input = document.getElementById('domain-input').value.trim();
      if (!input) return;
      var btn = document.getElementById('check-btn');
      var loading = document.getElementById('single-loading');
      var resultDiv = document.getElementById('single-result');

      btn.disabled = true;
      loading.classList.add('active');
      resultDiv.textContent = '';

      var params = new URLSearchParams();
      if (input.includes('://')) { params.set('url', input); } else { params.set('domain', input); }

      var kw = document.getElementById('sig-keywords').value;
      var tr = document.getElementById('sig-traffic').value;
      var bl = document.getElementById('sig-backlinks').value;
      var age = document.getElementById('sig-age').value;
      if (kw) params.set('keywordsTop100', kw);
      if (tr) params.set('traffic', tr);
      if (bl) params.set('backlinks', bl);
      if (age) params.set('domainAgeYears', age);

      try {
        var res = await fetch('/check?' + params.toString());
        var data = await res.json();
        if (!res.ok) {
          resultDiv.textContent = '';
          var errDiv = document.createElement('div');
          errDiv.className = 'result error';
          errDiv.textContent = data.error || 'Error';
          resultDiv.appendChild(errDiv);
          return;
        }
        renderSingleResult(resultDiv, input, data);
        addToHistory(input, data);
      } catch (err) {
        resultDiv.textContent = '';
        var errDiv = document.createElement('div');
        errDiv.className = 'result error';
        errDiv.textContent = 'Network error: ' + err.message;
        resultDiv.appendChild(errDiv);
      } finally {
        btn.disabled = false;
        loading.classList.remove('active');
      }
    }

    // Batch check
    document.getElementById('batch-btn').addEventListener('click', doBatchCheck);

    async function doBatchCheck() {
      var text = document.getElementById('batch-input').value.trim();
      if (!text) return;
      var domains = text.split('\\n').map(function(d) { return d.trim(); }).filter(Boolean);
      if (domains.length === 0) return;
      if (domains.length > 50) {
        var rd = document.getElementById('batch-result');
        rd.textContent = '';
        var errDiv = document.createElement('div');
        errDiv.className = 'result error';
        errDiv.textContent = 'Maximum 50 domains per batch.';
        rd.appendChild(errDiv);
        return;
      }

      var btn = document.getElementById('batch-btn');
      var loading = document.getElementById('batch-loading');
      var resultDiv = document.getElementById('batch-result');

      btn.disabled = true;
      loading.classList.add('active');
      resultDiv.textContent = '';

      try {
        var res = await fetch('/check/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domains: domains })
        });
        var data = await res.json();
        if (!res.ok) {
          var errDiv = document.createElement('div');
          errDiv.className = 'result error';
          errDiv.textContent = data.error || 'Error';
          resultDiv.appendChild(errDiv);
          return;
        }
        renderBatchTable(resultDiv, data.results);
        Object.entries(data.results).forEach(function(entry) { addToHistory(entry[0], entry[1]); });
      } catch (err) {
        var errDiv = document.createElement('div');
        errDiv.className = 'result error';
        errDiv.textContent = 'Network error: ' + err.message;
        resultDiv.appendChild(errDiv);
      } finally {
        btn.disabled = false;
        loading.classList.remove('active');
      }
    }

    function renderSingleResult(container, domain, data) {
      container.textContent = '';
      var div = document.createElement('div');
      div.className = 'result ' + (data.indexed ? 'indexed' : 'not-indexed');

      var domainDiv = document.createElement('div');
      domainDiv.className = 'domain';
      domainDiv.textContent = domain + ' — ' + (data.indexed ? 'Indexed' : 'Not Indexed');
      if (data.cachedAt) {
        var cachedSpan = document.createElement('span');
        cachedSpan.className = 'badge badge-cached';
        cachedSpan.textContent = 'cached';
        domainDiv.appendChild(document.createTextNode(' '));
        domainDiv.appendChild(cachedSpan);
      }
      div.appendChild(domainDiv);

      var metaDiv = document.createElement('div');
      metaDiv.className = 'meta';
      metaDiv.textContent = 'Confidence: ' + data.confidence + ' · Method: ' + data.method;
      div.appendChild(metaDiv);

      container.appendChild(div);
    }

    function renderBatchTable(container, results) {
      container.textContent = '';
      var table = document.createElement('table');
      var thead = document.createElement('thead');
      var headerRow = document.createElement('tr');
      ['Domain', 'Status', 'Confidence', 'Method'].forEach(function(h) {
        var th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      Object.entries(results).forEach(function(entry) {
        var domain = entry[0];
        var r = entry[1];
        var row = document.createElement('tr');

        var tdDomain = document.createElement('td');
        tdDomain.textContent = domain;
        row.appendChild(tdDomain);

        var tdStatus = document.createElement('td');
        var statusSpan = document.createElement('span');
        statusSpan.className = 'badge ' + (r.indexed ? 'badge-yes' : 'badge-no');
        statusSpan.textContent = r.indexed ? 'Yes' : 'No';
        tdStatus.appendChild(statusSpan);
        row.appendChild(tdStatus);

        var tdConf = document.createElement('td');
        var confSpan = document.createElement('span');
        confSpan.className = 'badge badge-' + r.confidence;
        confSpan.textContent = r.confidence;
        tdConf.appendChild(confSpan);
        row.appendChild(tdConf);

        var tdMethod = document.createElement('td');
        tdMethod.textContent = r.method;
        row.appendChild(tdMethod);

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      container.appendChild(table);
    }

    function addToHistory(domain, data) {
      history.unshift({ domain: domain, indexed: data.indexed, confidence: data.confidence, method: data.method });
      if (history.length > 50) history.pop();
      renderHistory();
    }

    function renderHistory() {
      var section = document.getElementById('history-section');
      var tbody = document.getElementById('history-body');
      if (history.length === 0) { section.style.display = 'none'; return; }
      section.style.display = 'block';
      tbody.textContent = '';
      history.forEach(function(h) {
        var row = document.createElement('tr');

        var tdDomain = document.createElement('td');
        tdDomain.textContent = h.domain;
        row.appendChild(tdDomain);

        var tdStatus = document.createElement('td');
        var statusSpan = document.createElement('span');
        statusSpan.className = 'badge ' + (h.indexed ? 'badge-yes' : 'badge-no');
        statusSpan.textContent = h.indexed ? 'Yes' : 'No';
        tdStatus.appendChild(statusSpan);
        row.appendChild(tdStatus);

        var tdConf = document.createElement('td');
        var confSpan = document.createElement('span');
        confSpan.className = 'badge badge-' + h.confidence;
        confSpan.textContent = h.confidence;
        tdConf.appendChild(confSpan);
        row.appendChild(tdConf);

        var tdMethod = document.createElement('td');
        tdMethod.textContent = h.method;
        row.appendChild(tdMethod);

        tbody.appendChild(row);
      });
    }
  </script>
</body>
</html>`;
