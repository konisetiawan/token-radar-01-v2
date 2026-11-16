(function() {
  'use strict';
  var DATA = window.RADAR;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'id') node.id = attrs[k];
        else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (k === 'value') node.value = attrs[k];
        else if (k === 'selected') node.selected = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.indexOf('aria-') === 0 || k === 'role' || k === 'type' || k === 'placeholder' || k === 'href') node.setAttribute(k, attrs[k]);
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function(c) {
        if (c == null) return;
        if (typeof c === 'string' || typeof c === 'number') {
          node.appendChild(document.createTextNode(c));
        } else if (c instanceof Node) {
          node.appendChild(c);
        }
      });
    }
    return node;
  }

  function fmtUsd(n) {
    if (n == null || isNaN(n)) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(2);
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return '—';
    var sign = n > 0 ? '+' : '';
    return sign + Number(n).toFixed(1) + '%';
  }

  function fmtAge(days) {
    if (days == null || isNaN(days)) return '—';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.round(days) + 'd';
  }

  var state = {
    q: '',
    category: 'all',
    chain: 'all',
    tvl: 'all',
    verdict: 'all',
    tab: 'board',
    sort: 'rank',
    dir: 1,
    selected: null
  };

  function readHash() {
    var h = location.hash.slice(1);
    if (!h) return;
    var params = new URLSearchParams(h);
    if (params.has('q')) state.q = params.get('q');
    if (params.has('cat')) state.category = params.get('cat');
    if (params.has('chain')) state.chain = params.get('chain');
    if (params.has('tvl')) state.tvl = params.get('tvl');
    if (params.has('verdict')) state.verdict = params.get('verdict');
    if (params.has('tab')) state.tab = params.get('tab');
    if (params.has('sort')) state.sort = params.get('sort');
    if (params.has('dir')) state.dir = parseInt(params.get('dir'), 10) || 1;
    if (params.has('sel')) state.selected = params.get('sel');
  }

  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category && state.category !== 'all') params.set('cat', state.category);
    if (state.chain && state.chain !== 'all') params.set('chain', state.chain);
    if (state.tvl && state.tvl !== 'all') params.set('tvl', state.tvl);
    if (state.verdict && state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.tab && state.tab !== 'board') params.set('tab', state.tab);
    if (state.sort && state.sort !== 'rank') params.set('sort', state.sort);
    if (state.dir !== 1) params.set('dir', state.dir);
    if (state.selected) params.set('sel', state.selected);
    var str = params.toString();
    history.replaceState(null, '', str ? '#' + str : location.pathname);
  }

  window.addEventListener('hashchange', function() {
    readHash();
    render();
  });
  readHash();

  function header() {
    return el('div', { class: 'top' }, [
      el('div', { class: 'brand-area' }, [
        el('h1', {}, 'Token Radar'),
        el('span', { class: 'sub' }, 'DefiLlama snapshot 2026-11-14 · 758 protocols · watchlist floor $50M')
      ])
    ]);
  }

  function hero() {
    return el('div', { class: 'hero' }, [
      el('h1', {}, '200 pre-token protocols ranked by what a launch would be worth — fitted from 117 real token launches.'),
      el('div', { class: 'tiles' }, [
        el('div', { class: 'tile', text: DATA.rows.length + ' rows' }),
        el('div', { class: 'tile', text: DATA.watchlist_size + '/40 watchlist' }),
        el('div', { class: 'tile', text: DATA.farm_counts.farm + ' FARM' }),
        el('div', { class: 'tile', text: 'LOO ×' + DATA.backtest.loo_miss.toFixed(2) })
      ])
    ]);
  }

  function bestFarms() {
    var sorted = DATA.rows.slice().sort(function(a, b) {
      return (b.net_per_hour_usd || 0) - (a.net_per_hour_usd || 0);
    });
    var top5 = sorted.slice(0, 5);
    var list = el('div', { class: 'best-list' }, top5.map(function(r) {
      var text = '#' + r.rank + ' ' + r.name + ' — ' + fmtUsd(r.net_per_hour_usd) + '/hr, $1K slice ' + fmtUsd(r.slice_usd) + ', gas ' + fmtUsd(r.gas_usd);
      return el('div', {
        class: 'best-item',
        tabindex: '0',
        role: 'button',
        onclick: function() { openDetail(r.slug); },
        onkeydown: function(e) { if (e.key === 'Enter') openDetail(r.slug); }
      }, text);
    }));
    return el('div', { class: 'best' }, [
      el('h3', {}, 'Best farms by net $/hr'),
      list
    ]);
  }

  function researchNote() {
    var bullets = [
      "The three biggest launches are the worst farms per dollar: at $1,000 their slice is $2–$3 against $3–$6 of gas, fees and forgone yield, so they read SKIP.",
      "The money is in the middle: 181 of 200 rows clear $1/hr after costs, most on cheap chains where gas is $0.10–$0.50, not $8.",
      "Every value is a band, not a point: the P10–P90 band is value ÷/× 12.8, so rank 1 and rank 20 overlap — read the band before the rank.",
      "Nothing here predicts a token: it prices what a launch would be worth IF the record stays as it is, from TVL, 7-day growth and age with no token."
    ];
    return el('div', { class: 'note' }, [
      el('h3', {}, 'What the board says'),
      el('ul', {}, bullets.map(function(b) { return el('li', {}, b); }))
    ]);
  }

  function controls() {
    var cats = ['all'];
    DATA.rows.forEach(function(r) {
      if (r.category && cats.indexOf(r.category) === -1) cats.push(r.category);
    });

    var chains = ['all'];
    DATA.rows.forEach(function(r) {
      if (r.chains && r.chains.length > 0) {
        var c = r.chains[0];
        if (chains.indexOf(c) === -1) chains.push(c);
      }
    });

    var searchInput = el('input', {
      type: 'text',
      placeholder: 'Search protocol…',
      value: state.q,
      oninput: function(e) {
        state.q = e.target.value;
        writeHash();
        render();
      }
    });

    var catSelect = el('select', {
      onchange: function(e) {
        state.category = e.target.value;
        writeHash();
        render();
      }
    }, cats.map(function(c) {
      return el('option', { value: c, selected: state.category === c }, c === 'all' ? 'All categories' : c);
    }));

    var chainSelect = el('select', {
      onchange: function(e) {
        state.chain = e.target.value;
        writeHash();
        render();
      }
    }, chains.map(function(c) {
      return el('option', { value: c, selected: state.chain === c }, c === 'all' ? 'All chains' : c);
    }));

    var tvlOptions = [
      { value: 'all', label: 'All TVL' },
      { value: 'gt1b', label: '≥$1B' },
      { value: '100m-1b', label: '$100M–$1B' },
      { value: '50m-100m', label: '$50M–$100M' },
      { value: 'lt50m', label: '<$50M' }
    ];
    var tvlSelect = el('select', {
      onchange: function(e) {
        state.tvl = e.target.value;
        writeHash();
        render();
      }
    }, tvlOptions.map(function(o) {
      return el('option', { value: o.value, selected: state.tvl === o.value }, o.label);
    }));

    var verdictOptions = ['all', 'FARM', 'THIN', 'SKIP'];
    var verdictSelect = el('select', {
      onchange: function(e) {
        state.verdict = e.target.value;
        writeHash();
        render();
      }
    }, verdictOptions.map(function(v) {
      return el('option', { value: v, selected: state.verdict === v }, v === 'all' ? 'All verdicts' : v);
    }));

    var tabs = [
      { id: 'board', label: 'No token yet' },
      { id: 'live', label: 'Token trades' },
      { id: 'aside', label: 'Set aside' },
      { id: 'method', label: 'Method and backtest' }
    ];
    var tabBtns = el('div', { class: 'tabs' }, tabs.map(function(t) {
      return el('button', {
        class: 'tab' + (state.tab === t.id ? ' active' : ''),
        onclick: function() {
          state.tab = t.id;
          writeHash();
          render();
        }
      }, t.label);
    }));

    var filtered = getFilteredRows();
    var countEl = el('div', { class: 'count' }, filtered.length + ' rows shown');

    return el('div', { class: 'controls' }, [
      el('div', { class: 'filters-row' }, [searchInput, catSelect, chainSelect, tvlSelect, verdictSelect]),
      el('div', { class: 'nav-row' }, [tabBtns, countEl])
    ]);
  }

  function getFilteredRows() {
    return DATA.rows.filter(function(r) {
      if (state.q) {
        var q = state.q.toLowerCase();
        if ((r.name || '').toLowerCase().indexOf(q) === -1 && (r.slug || '').toLowerCase().indexOf(q) === -1) {
          return false;
        }
      }
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (!r.chains || r.chains[0] !== state.chain)) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (state.tvl !== 'all') {
        var tvl = r.tvl_usd || 0;
        if (state.tvl === 'gt1b' && tvl < 1e9) return false;
        if (state.tvl === '100m-1b' && (tvl < 100e6 || tvl >= 1e9)) return false;
        if (state.tvl === '50m-100m' && (tvl < 50e6 || tvl >= 100e6)) return false;
        if (state.tvl === 'lt50m' && tvl >= 50e6) return false;
      }
      return true;
    });
  }

  function boardTable() {
    var rows = getFilteredRows();
    rows.sort(function(a, b) {
      var valA, valB;
      if (state.sort === 'rank') { valA = a.rank; valB = b.rank; }
      else if (state.sort === 'name') { valA = (a.name || '').toLowerCase(); valB = (b.name || '').toLowerCase(); return valA < valB ? -state.dir : valA > valB ? state.dir : 0; }
      else if (state.sort === 'tvl') { valA = a.tvl_usd || 0; valB = b.tvl_usd || 0; }
      else if (state.sort === 'growth') { valA = a.change_7d || 0; valB = b.change_7d || 0; }
      else if (state.sort === 'age') { valA = a.age_days || 0; valB = b.age_days || 0; }
      else if (state.sort === 'implied') { valA = a.implied_value_usd || 0; valB = b.implied_value_usd || 0; }
      else if (state.sort === 'slice') { valA = a.slice_usd || 0; valB = b.slice_usd || 0; }
      else if (state.sort === 'net') { valA = a.net_per_hour_usd || 0; valB = b.net_per_hour_usd || 0; }
      else { valA = a.rank; valB = b.rank; }
      return (valA - valB) * state.dir;
    });

    if (rows.length === 0) {
      return el('div', { class: 'empty-state' }, [
        el('p', {}, 'No protocols match your filters.'),
        el('button', {
          onclick: function() {
            state.q = '';
            state.category = 'all';
            state.chain = 'all';
            state.tvl = 'all';
            state.verdict = 'all';
            writeHash();
            render();
          }
        }, 'Clear filters')
      ]);
    }

    var headers = [
      { key: 'rank', label: 'Rank' },
      { key: 'name', label: 'Protocol' },
      { key: 'category', label: 'Category' },
      { key: 'tvl', label: 'TVL' },
      { key: 'growth', label: '7d' },
      { key: 'age', label: 'Age' },
      { key: 'implied', label: 'Implied value' },
      { key: 'slice', label: '$1K slice' },
      { key: 'net', label: 'Net $/hr' },
      { key: 'verdict', label: 'Verdict' }
    ];

    var thead = el('thead', {}, [
      el('tr', {}, headers.map(function(h) {
        var isSorted = state.sort === h.key;
        var arrow = isSorted ? (state.dir === 1 ? ' ▲' : ' ▼') : '';
        return el('th', {
          onclick: function() {
            if (state.sort === h.key) {
              state.dir = -state.dir;
            } else {
              state.sort = h.key;
              state.dir = 1;
            }
            writeHash();
            render();
          }
        }, h.label + arrow);
      }))
    ]);

    var tbody = el('tbody', {}, rows.map(function(r) {
      var vClass = 'verdict-' + (r.verdict || '').toLowerCase();
      var chainBadge = el('div', { class: 'chains', text: r.chains[0] || '' });
      return el('tr', {
        tabindex: '0',
        onclick: function() { openDetail(r.slug); },
        onkeydown: function(e) { if (e.key === 'Enter') openDetail(r.slug); }
      }, [
        el('td', {}, '#' + r.rank),
        el('td', {}, [el('strong', {}, r.name), chainBadge]),
        el('td', {}, r.category || '—'),
        el('td', {}, fmtUsd(r.tvl_usd)),
        el('td', {}, fmtPct(r.change_7d)),
        el('td', {}, fmtAge(r.age_days)),
        el('td', {}, fmtUsd(r.implied_value_usd)),
        el('td', {}, fmtUsd(r.slice_usd)),
        el('td', {}, fmtUsd(r.net_per_hour_usd)),
        el('td', {}, [el('span', { class: 'badge ' + vClass }, r.verdict)])
      ]);
    }));

    return el('div', { class: 'table-wrap' }, [
      el('table', {}, [thead, tbody])
    ]);
  }

  function render() {
    var root = document.getElementById('board');
    if (!root) return;
    root.innerHTML = '';
    document.title = 'Token Radar: pre-token protocols ranked by implied value';

    root.appendChild(header());
    root.appendChild(hero());
    root.appendChild(controls());

    var content;
    if (state.tab === 'live') {
      content = liveTable();
    } else if (state.tab === 'aside') {
      content = asidePanel();
    } else if (state.tab === 'method') {
      content = methodPanel();
    } else {
      content = boardTable();
    }
    root.appendChild(content);

    if (state.tab === 'board') {
      root.appendChild(bestFarms());
      root.appendChild(researchNote());
    }

    if (state.selected) {
      openDetail(state.selected);
    }
  }

  render();

  function liveTable() {
    var items = DATA.live.slice().sort(function(a, b) {
      return (b.mcap_usd || 0) - (a.mcap_usd || 0);
    });
    return el('table', {}, [
      el('caption', {}, 'Already trading: market cap is a fact, not a model. These ' + DATA.live.length + ' are set aside from the pre-token ranking.'),
      el('thead', {}, el('tr', {}, [
        el('th', {}, 'Protocol'),
        el('th', {}, 'Category'),
        el('th', {}, 'TVL'),
        el('th', {}, 'Market cap'),
        el('th', {}, 'Multiple'),
        el('th', {}, '7d')
      ])),
      el('tbody', {}, items.map(function(r) {
        var mult = (r.mcap_usd && r.tvl_usd && r.tvl_usd > 0) ? '×' + (r.mcap_usd / r.tvl_usd).toFixed(2) : '—';
        return el('tr', {}, [
          el('td', {}, el('strong', {}, r.name)),
          el('td', {}, r.category || '—'),
          el('td', {}, fmtUsd(r.tvl_usd)),
          el('td', {}, fmtUsd(r.mcap_usd)),
          el('td', {}, mult),
          el('td', {}, fmtPct(r.change_7d))
        ]);
      }))
    ]);
  }

  function asidePanel() {
    var bullets = [
      'The ' + DATA.live.length + ' live-token protocols in "Token trades".',
      'Wrapped, staked, bridged, versioned and exchange protocols excluded from the watchlist.',
      'Protocols below the $5M snapshot floor.'
    ];
    return el('aside', { class: 'panel' }, [
      el('h2', {}, 'Set aside'),
      el('ul', {}, bullets.map(function(b) { return el('li', {}, b); })),
      el('p', {}, 'Nothing on this page is a price prediction.')
    ]);
  }

  function methodPanel() {
    var SVGNS = document.documentElement.namespaceURI.replace(/1999\/xhtml$/, '2000/svg');
    function svgEl(tag, attrs, children) {
      var node = document.createElementNS(SVGNS, tag);
      if (attrs) {
        for (var k in attrs) {
          if (k === 'class') node.className.baseVal = attrs[k];
          else node.setAttribute(k, attrs[k]);
        }
      }
      if (children) {
        if (!Array.isArray(children)) children = [children];
        children.forEach(function(c) {
          if (c == null) return;
          if (typeof c === 'string' || typeof c === 'number') {
            node.appendChild(document.createTextNode(c));
          } else if (c instanceof Node) {
            node.appendChild(c);
          }
        });
      }
      return node;
    }
    var model = DATA.model;
    var formulaLines = [
      'ln(implied value) = intercept + slope·ln(TVL) + category + growth_slope·growth7d + age_slope·age_years',
      'Implied value = exp(the fitted log value) × sibling discount',
      'P10–P90 band = value ÷/× exp(1.28·residual_sd)',
      'intercept = ' + model.intercept + '; slope = ' + model.slope + '; growth_slope = ' + model.growth_slope + '; age_slope = ' + model.age_slope,
      'Fitted from ' + model.comps_count + ' token launches; R² = ' + model.r_squared + '; residual sd = ' + model.residual_sd,
      'Model version: ' + model.model_version,
      'Category factors: ' + Object.entries(model.category_factors).map(function(entry) { return entry[0] + ': ' + entry[1]; }).join('; ')
    ].join('\n');

    var formulaDiv = el('div', { class: 'formula', style: 'white-space: pre-wrap; font-family: monospace;' }, formulaLines);

    var b = DATA.backtest;
    function pct(v) { return (v * 100).toFixed(1) + '%'; }

    var backtestTable = el('table', {}, [
      el('caption', {}, 'Backtest'),
      el('thead', {}, el('tr', {}, [
        el('th', {}, 'Evaluation'),
        el('th', {}, 'Miss'),
        el('th', {}, 'Within 3×'),
        el('th', {}, 'Within 10×'),
        el('th', {}, 'n'),
        el('th', {}, 'Time miss'),
        el('th', {}, 'Time within 3×')
      ])),
      el('tbody', {}, [
        el('tr', {}, [
          el('td', {}, 'Leave-one-out (blind)'),
          el('td', {}, '×' + b.loo_miss.toFixed(2)),
          el('td', {}, pct(b.loo_within3)),
          el('td', {}, pct(b.loo_within10)),
          el('td', {}, b.loo_n),
          el('td', {}, '—'),
          el('td', {}, '—')
        ]),
        el('tr', {}, [
          el('td', {}, 'Time-split'),
          el('td', {}, '×' + b.time_miss.toFixed(2)),
          el('td', {}, pct(b.time_within3)),
          el('td', {}, '—'),
          el('td', {}, b.time_n),
          el('td', {}, '—'),
          el('td', {}, '—')
        ]),
        el('tr', {}, [
          el('td', {}, 'Flat baseline'),
          el('td', {}, 'LOO ×' + b.flat_loo_miss.toFixed(2)),
          el('td', {}, pct(b.flat_loo_within3)),
          el('td', {}, '—'),
          el('td', {}, '—'),
          el('td', {}, '×' + b.flat_time_miss.toFixed(2)),
          el('td', {}, pct(b.flat_time_within3))
        ])
      ])
    ]);

    var yardstickRows = (DATA.yardstick || []).filter(function(y) {
      return y.comps >= 3;
    }).sort(function(a, b) {
      return b.median_multiple - a.median_multiple;
    }).map(function(y) {
      return el('tr', {}, [
        el('td', {}, y.category),
        el('td', {}, y.comps),
        el('td', {}, '×' + y.median_multiple.toFixed(2)),
        el('td', {}, '×' + Math.exp(y.factor).toFixed(3))
      ]);
    });

    var yardstickTable = el('table', {}, [
      el('caption', {}, 'Category yardstick — median mcap/TVL among the token launches in each category'),
      el('thead', {}, el('tr', {}, [
        el('th', {}, 'Category'),
        el('th', {}, 'Launches'),
        el('th', {}, 'Median multiple'),
        el('th', {}, 'Factor')
      ])),
      el('tbody', {}, yardstickRows)
    ]);

    var pts = [];
    DATA.rows.forEach(function(r) {
      if (r.tvl_usd > 0 && r.implied_value_usd > 0) {
        pts.push({ name: r.name, tvl: r.tvl_usd, value: r.implied_value_usd, color: '#fbbf24' });
      }
    });
    DATA.live.forEach(function(r) {
      if (r.tvl_usd > 0 && r.mcap_usd > 0) {
        pts.push({ name: r.name, tvl: r.tvl_usd, value: r.mcap_usd, color: '#22d3ee' });
      }
    });

    var gridTvls = [1e7, 1e8, 1e9, 1e10];
    var gridVals = [1e6, 1e7, 1e8, 1e9];

    var allLogTvl = pts.map(function(p) { return Math.log(p.tvl); }).concat(gridTvls.map(function(v) { return Math.log(v); }));
    var allLogVal = pts.map(function(p) { return Math.log(p.value); }).concat(gridVals.map(function(v) { return Math.log(v); }));

    var minLogTvl = Math.min.apply(null, allLogTvl);
    var maxLogTvl = Math.max.apply(null, allLogTvl);
    var minLogVal = Math.min.apply(null, allLogVal);
    var maxLogVal = Math.max.apply(null, allLogVal);

    var x1 = 72, x2 = 696;
    var y1 = 20, y2 = 264;

    function getX(tvl) {
      if (maxLogTvl === minLogTvl) return x1;
      return x1 + (Math.log(tvl) - minLogTvl) / (maxLogTvl - minLogTvl) * (x2 - x1);
    }
    function getY(val) {
      if (maxLogVal === minLogVal) return y2;
      return y2 - (Math.log(val) - minLogVal) / (maxLogVal - minLogVal) * (y2 - y1);
    }

    var svgChildren = [];
    gridTvls.forEach(function(tvl) {
      var cx = getX(tvl);
      if (cx >= x1 && cx <= x2) {
        svgChildren.push(svgEl('line', { x1: cx, y1: y1, x2: cx, y2: y2, stroke: '#334155', 'stroke-dasharray': '2' }));
        svgChildren.push(svgEl('text', { x: cx, y: y2 + 16, 'text-anchor': 'middle', fill: '#94a3b8', 'font-size': '10' }, fmtUsd(tvl)));
      }
    });
    gridVals.forEach(function(val) {
      var cy = getY(val);
      if (cy >= y1 && cy <= y2) {
        svgChildren.push(svgEl('line', { x1: x1, y1: cy, x2: x2, y2: cy, stroke: '#334155', 'stroke-dasharray': '2' }));
        svgChildren.push(svgEl('text', { x: x1 - 8, y: cy + 4, 'text-anchor': 'end', fill: '#94a3b8', 'font-size': '10' }, fmtUsd(val)));
      }
    });

    var tvlStart = Math.exp(minLogTvl);
    var tvlEnd = Math.exp(maxLogTvl);
    var valStart = Math.exp(model.intercept + model.slope * minLogTvl);
    var valEnd = Math.exp(model.intercept + model.slope * maxLogTvl);
    svgChildren.push(svgEl('line', {
      x1: getX(tvlStart),
      y1: getY(valStart),
      x2: getX(tvlEnd),
      y2: getY(valEnd),
      stroke: '#fbbf24',
      'stroke-dasharray': '4',
      'stroke-width': '1.5',
      opacity: '0.7'
    }));

    pts.forEach(function(p) {
      var cx = getX(p.tvl);
      var cy = getY(p.value);
      if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
        var circle = svgEl('circle', { cx: cx, cy: cy, r: '3', fill: p.color, opacity: '0.8' }, [
          svgEl('title', {}, p.name + ': TVL ' + fmtUsd(p.tvl) + ', value ' + fmtUsd(p.value))
        ]);
        svgChildren.push(circle);
      }
    });

    svgChildren.push(svgEl('text', { x: (x1 + x2) / 2, y: 310, 'text-anchor': 'middle', fill: '#cbd5e1', 'font-size': '11' }, 'TVL (log scale)'));
    svgChildren.push(svgEl('text', { transform: 'rotate(-90)', x: -(y1 + y2) / 2, y: 24, 'text-anchor': 'middle', fill: '#cbd5e1', 'font-size': '11' }, 'Value (log scale)'));

    var svgNode = svgEl('svg', {
      viewBox: '0 0 720 320',
      width: '720',
      height: '320',
      role: 'img',
      'aria-label': 'TVL versus implied value and live market cap, on logarithmic axes',
      style: 'max-width: 100%; height: auto;'
    }, svgChildren);

    var legendText = 'Amber: ' + DATA.rows.length + ' pre-token implied values. Cyan: ' + DATA.live.length + ' live market caps. Dashed line: intercept + slope·ln(TVL), before other adjustments.';
    var legendP = el('p', { class: 'legend' }, legendText);

    return el('section', { class: 'panel method' }, [
      el('h2', {}, 'Method and validation'),
      formulaDiv,
      el('h3', {}, 'Backtest'),
      backtestTable,
      el('h3', {}, 'Yardstick'),
      yardstickTable,
      svgNode,
      legendP
    ]);
  }

  // Open detail dialog for selected protocol slug
  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) {
      if (DATA.rows[i].slug === slug) {
        row = DATA.rows[i];
        break;
      }
    }
    if (!row) return;

    state.selected = row.slug;
    writeHash();

    var dialog = document.getElementById('detail');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'detail';
      dialog.className = 'detail';
      dialog.addEventListener('close', function() {
        state.selected = null;
        writeHash();
      });
      document.body.appendChild(dialog);
    }

    dialog.innerHTML = '';

    var model = DATA.model;
    var lnTvl = Math.log(row.tvl_usd);
    var base = Math.exp(model.intercept + model.slope * lnTvl);
    var category = Math.exp(model.category_factors[row.category] ?? 0);
    var clampedGrowth = Math.max(-30, Math.min(60, row.change_7d ?? 0));
    var growth = Math.exp(model.growth_slope * clampedGrowth);
    var ageYears = (row.age_days ?? 0) / 365.25;
    var age = Math.exp(model.age_slope * ageYears);
    var sibling = row.implied_value_usd / (base * category * growth * age);

    var stepsList = el('ol', { class: 'steps' }, (row.farm_steps || []).map(function(step) {
      return el('li', {}, step);
    }));

    var closeBtn = el('button', {
      type: 'button',
      onclick: function() {
        dialog.close();
      }
    }, 'Close');

    dialog.appendChild(el('h2', {}, row.name + ' · #' + row.rank));
    dialog.appendChild(el('p', {}, (row.category || '—') + ' · ' + (row.chains || []).join(', ')));
    dialog.appendChild(el('p', {}, 'TVL: ' + fmtUsd(row.tvl_usd) + ' · 7d: ' + fmtPct(row.change_7d) + ' · Age: ' + fmtAge(row.age_days)));
    dialog.appendChild(el('h3', {}, 'Implied value: ' + fmtUsd(row.implied_value_usd)));
    dialog.appendChild(el('p', {}, 'P10–P90: ' + fmtUsd(row.implied_low_usd) + '–' + fmtUsd(row.implied_high_usd)));
    dialog.appendChild(el('p', {}, (row.verdict || '') + ' · $1K slice: ' + fmtUsd(row.slice_usd) + ' · Net $/hr: ' + fmtUsd(row.net_per_hour_usd) + ' · Gas (' + (row.chains[0] || 'chain') + '): $' + (row.gas_usd != null ? row.gas_usd : '—')));

    dialog.appendChild(el('h3', {}, 'Model decomposition'));
    var dl = el('dl', {}, [
      el('dt', {}, 'Base · exp(intercept + slope × ln TVL)'),
      el('dd', {}, fmtUsd(base)),
      el('dt', {}, 'Category · exp(category factor)'),
      el('dd', {}, '× ' + category.toFixed(3)),
      el('dt', {}, 'Growth · exp(growth slope × clamped 7d change)'),
      el('dd', {}, '× ' + growth.toFixed(3)),
      el('dt', {}, 'Age · exp(age slope × age in years)'),
      el('dd', {}, '× ' + age.toFixed(3)),
      el('dt', {}, 'Sibling · implied value / (base × category × growth × age)'),
      el('dd', {}, '× ' + sibling.toFixed(3))
    ]);
    dialog.appendChild(dl);

    dialog.appendChild(el('p', {}, 'Base × category × growth × age × sibling = ' + fmtUsd(row.implied_value_usd)));

    dialog.appendChild(el('h3', {}, 'Farm plan — $1,000, costed'));
    dialog.appendChild(stepsList);
    dialog.appendChild(closeBtn);

    if (!dialog.open) {
      dialog.showModal();
    }
    dialog.scrollTop = 0;
  }
})();