export const MODEL_VERSION = 'radar-3';

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  intercept: number;
  slope: number;
  r_squared: number;
  residual_sd: number;
  comps_count: number;
  growth_slope: number;
  age_slope: number;
  category_factors: Record<string, number>;
  model_version: string;
}

export function parseSnapshot(text: string): Snapshot {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch (err: any) {
    throw new Error('Invalid JSON: ' + (err?.message || err));
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid Snapshot: must be a non-array object');
  }
  if (typeof raw.as_of !== 'string' || isNaN(Date.parse(raw.as_of))) {
    throw new Error('Invalid Snapshot: as_of must be a valid date string');
  }
  if (typeof raw.source !== 'string') {
    throw new Error('Invalid Snapshot: source must be a string');
  }
  if (typeof raw.floor_usd !== 'number' || !Number.isInteger(raw.floor_usd) || raw.floor_usd <= 0) {
    throw new Error('Invalid Snapshot: floor_usd must be a positive integer');
  }
  if (!Array.isArray(raw.protocols)) {
    throw new Error('Invalid Snapshot: protocols must be an array');
  }
  if (!Array.isArray(raw.watchlist) || raw.watchlist.some((w: any) => typeof w !== 'string')) {
    throw new Error('Invalid Snapshot: watchlist must be an array of strings');
  }

  const protocols: SnapshotProtocol[] = [];
  for (let i = 0; i < raw.protocols.length; i++) {
    const p = raw.protocols[i];
    if (!p || typeof p !== 'object') {
      throw new Error(`Invalid protocol at index ${i}: must be an object`);
    }
    if (typeof p.slug !== 'string') {
      throw new Error(`Invalid protocol at index ${i}: slug must be a string`);
    }
    if (typeof p.name !== 'string') {
      throw new Error(`Invalid protocol at index ${i}: name must be a string`);
    }
    if (typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new Error(`Invalid protocol at index ${i}: tvl_usd must be a finite number`);
    }
    if (p.category !== null && typeof p.category !== 'string') {
      throw new Error(`Invalid protocol at index ${i}: category must be string or null`);
    }
    if (!Array.isArray(p.chains) || p.chains.some((c: any) => typeof c !== 'string')) {
      throw new Error(`Invalid protocol at index ${i}: chains must be an array of strings`);
    }
    if (p.change_7d !== null && (typeof p.change_7d !== 'number' || !Number.isFinite(p.change_7d))) {
      throw new Error(`Invalid protocol at index ${i}: change_7d must be a finite number or null`);
    }
    if (p.mcap_usd !== null && (typeof p.mcap_usd !== 'number' || !Number.isFinite(p.mcap_usd))) {
      throw new Error(`Invalid protocol at index ${i}: mcap_usd must be a finite number or null`);
    }
    if (p.listed_at !== null && typeof p.listed_at !== 'string') {
      throw new Error(`Invalid protocol at index ${i}: listed_at must be a string or null`);
    }
    if (p.gecko_id !== null && typeof p.gecko_id !== 'string') {
      throw new Error(`Invalid protocol at index ${i}: gecko_id must be a string or null`);
    }
    if (p.symbol !== null && typeof p.symbol !== 'string') {
      throw new Error(`Invalid protocol at index ${i}: symbol must be a string or null`);
    }

    protocols.push({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: [...p.chains],
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
    });
  }

  return {
    as_of: raw.as_of,
    source: raw.source,
    floor_usd: raw.floor_usd,
    protocols,
    watchlist: [...raw.watchlist],
  };
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (!asOf || !listedAt) return null;
  const t1 = Date.parse(asOf);
  const t2 = Date.parse(listedAt);
  if (isNaN(t1) || isNaN(t2)) return null;
  const diffMs = t1 - t2;
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

interface Point {
  x: number;
  y: number;
}

function regress(points: Point[]): {
  intercept: number;
  slope: number;
  residuals: number[];
  r_squared: number;
  residual_sd: number;
} {
  const n = points.length;
  if (n < 3) {
    throw new Error('Fewer than 3 points for regression');
  }
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    num += dx * dy;
    den += dx * dx;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  const residuals: number[] = [];
  let sse = 0;
  let yy = 0;
  for (const p of points) {
    const yPred = intercept + slope * p.x;
    const res = p.y - yPred;
    residuals.push(res);
    sse += res * res;
    const dy = p.y - meanY;
    yy += dy * dy;
  }

  const r_squared = yy === 0 ? 0 : clamp(1 - sse / yy, 0, 1);
  const residual_sd = Math.sqrt(sse / Math.max(1, n - 2));

  return { intercept, slope, residuals, r_squared, residual_sd };
}

// Fit valuation model constants from protocol snapshot
export function fitModel(snapshot: Snapshot): ModelConstants {
  const allCategories = new Set<string>();
  for (const p of snapshot.protocols) {
    if (p.category !== null) {
      allCategories.add(p.category);
    }
  }

  const excluded = new Set(['usdt', 'usdc', 'dai', 'usde', 'usdd', 'frax']);
  const validComps: { protocol: SnapshotProtocol; x: number; y: number }[] = [];

  for (const p of snapshot.protocols) {
    if (typeof p.mcap_usd !== 'number' || !Number.isFinite(p.mcap_usd) || p.mcap_usd <= 0) continue;
    if (typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd) || p.tvl_usd <= 0) continue;
    const cat = p.category ? p.category.toLowerCase() : '';
    if (cat === 'cex') continue;
    if (cat.includes('stablecoin')) continue;
    const sym = p.symbol ? p.symbol.toLowerCase() : '';
    const name = p.name ? p.name.toLowerCase() : '';
    if (excluded.has(sym) || excluded.has(name)) continue;

    validComps.push({
      protocol: p,
      x: Math.log(p.tvl_usd),
      y: Math.log(p.mcap_usd),
    });
  }

  const initialPoints = validComps.map(c => ({ x: c.x, y: c.y }));
  const initialFit = regress(initialPoints);

  const survivors: { protocol: SnapshotProtocol; x: number; y: number; residual: number }[] = [];
  for (let i = 0; i < validComps.length; i++) {
    if (Math.abs(initialFit.residuals[i]) <= 3 * initialFit.residual_sd) {
      survivors.push({
        protocol: validComps[i].protocol,
        x: validComps[i].x,
        y: validComps[i].y,
        residual: initialFit.residuals[i],
      });
    }
  }

  if (survivors.length < 3) {
    throw new Error('Fewer than 3 comps remain after outlier removal');
  }

  const survivorPoints = survivors.map(s => ({ x: s.x, y: s.y }));
  const finalFit = regress(survivorPoints);

  // Recalculate residuals for survivors based on final fit
  const finalResiduals: number[] = [];
  for (const s of survivors) {
    const yPred = finalFit.intercept + finalFit.slope * s.x;
    finalResiduals.push(s.y - yPred);
  }

  const categoryResiduals: Record<string, number[]> = {};
  const growthPoints: Point[] = [];
  const agePoints: Point[] = [];

  for (let i = 0; i < survivors.length; i++) {
    const s = survivors[i];
    const res = finalResiduals[i];
    const cat = s.protocol.category;
    if (cat !== null) {
      if (!categoryResiduals[cat]) {
        categoryResiduals[cat] = [];
      }
      categoryResiduals[cat].push(res);
    }

    const change7d = s.protocol.change_7d ?? 0;
    growthPoints.push({
      x: clamp(change7d, -30, 60),
      y: res,
    });

    const days = ageDays(snapshot.as_of, s.protocol.listed_at);
    if (days !== null) {
      agePoints.push({
        x: days / 365.25,
        y: res,
      });
    }
  }

  const growth_slope = growthPoints.length >= 3 ? regress(growthPoints).slope : 0;
  const age_slope = agePoints.length >= 3 ? regress(agePoints).slope : 0;

  const category_factors: Record<string, number> = {};
  for (const cat of allCategories) {
    category_factors[cat] = 0;
  }

  for (const [cat, resList] of Object.entries(categoryResiduals)) {
    const n = resList.length;
    if (n >= 5) {
      const med = median(resList);
      const factor = clamp((med * n) / (n + 5), -0.7, 0.7);
      category_factors[cat] = factor;
    }
  }

  return {
    intercept: finalFit.intercept,
    slope: finalFit.slope,
    r_squared: finalFit.r_squared,
    residual_sd: finalFit.residual_sd,
    comps_count: survivors.length,
    growth_slope,
    age_slope,
    category_factors,
    model_version: MODEL_VERSION,
  };
}

export function impliedValue(
  protocol: SnapshotProtocol,
  model: ModelConstants,
  asOf: string,
  siblingFactor?: number
): { value: number; low: number; high: number } {
  const tvl = protocol.tvl_usd;
  const lnTvl = Math.log(tvl > 0 ? tvl : 1);
  const base = Math.exp(model.intercept + model.slope * lnTvl);
  const catKey = protocol.category;
  const categoryFactor = catKey !== null && catKey !== undefined && model.category_factors[catKey] !== undefined
    ? Math.exp(model.category_factors[catKey])
    : 1;
  const change = protocol.change_7d ?? 0;
  const clampedChange = Math.max(-30, Math.min(60, change));
  const growthFactor = Math.exp(model.growth_slope * clampedChange);
  const days = ageDays(asOf, protocol.listed_at) ?? 0;
  const ageYears = days / 365.25;
  const ageFactor = Math.exp(model.age_slope * ageYears);
  const sibling = siblingFactor ?? 1;
  const value = base * categoryFactor * growthFactor * ageFactor * sibling;
  const band = Math.exp(1.28 * model.residual_sd);
  const low = value / band;
  const high = value * band;
  return { value, low, high };
}

export interface BacktestResult {
  loo_miss: number;
  loo_within3: number;
  loo_within10: number;
  loo_n: number;
  time_miss: number;
  time_within3: number;
  time_n: number;
  flat_loo_miss: number;
  flat_loo_within3: number;
  flat_time_miss: number;
  flat_time_within3: number;
}

// Backtest model performance using leave-one-out and time-split validation
export function backtestModel(snapshot: Snapshot, model: ModelConstants): BacktestResult {
  const stablecoins = new Set(['usdt', 'usdc', 'dai', 'usde', 'usdd', 'frax']);
  const compsRaw = snapshot.protocols.filter(p => {
    if (p.mcap_usd === null || p.mcap_usd === undefined || !Number.isFinite(p.mcap_usd) || p.mcap_usd <= 0) return false;
    if (p.tvl_usd === null || p.tvl_usd === undefined || !Number.isFinite(p.tvl_usd) || p.tvl_usd <= 0) return false;
    const cat = p.category ? p.category.toLowerCase() : '';
    if (cat === 'cex') return false;
    if (cat.includes('stablecoin')) return false;
    const name = p.name ? p.name.toLowerCase() : '';
    const symbol = p.symbol ? p.symbol.toLowerCase() : '';
    if (stablecoins.has(name) || stablecoins.has(symbol)) return false;
    return true;
  });

  const comps = compsRaw.map(p => ({
    x: Math.log(p.tvl_usd!),
    y: Math.log(p.mcap_usd!),
    multiple: p.mcap_usd! / p.tvl_usd!,
    category: p.category,
    change_7d: p.change_7d ?? 0,
    listed_at: p.listed_at,
    p
  }));

  const localMedian = (nums: number[]): number => {
    if (nums.length === 0) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  };

  const localFit = (points: { x: number; y: number }[]): { intercept: number; slope: number } => {
    if (points.length === 0) return { intercept: 0, slope: 0 };
    let sumX = 0;
    let sumY = 0;
    for (const pt of points) {
      sumX += pt.x;
      sumY += pt.y;
    }
    const meanX = sumX / points.length;
    const meanY = sumY / points.length;
    let num = 0;
    let den = 0;
    for (const pt of points) {
      const dx = pt.x - meanX;
      num += dx * (pt.y - meanY);
      den += dx * dx;
    }
    const slope = den !== 0 ? num / den : 0;
    const intercept = meanY - slope * meanX;
    return { intercept, slope };
  };

  const modelError = (p: typeof comps[0], m: ModelConstants): number => {
    const catFactor = (p.category !== null && p.category !== undefined && m.category_factors[p.category] !== undefined)
      ? m.category_factors[p.category]
      : 0;
    const clampedGrowth = Math.max(-30, Math.min(60, p.change_7d));
    const ageDaysVal = ageDays(snapshot.as_of, p.listed_at) ?? 0;
    const ageYears = ageDaysVal / 365.25;
    const expectedY = m.intercept + m.slope * p.x + catFactor + m.growth_slope * clampedGrowth + m.age_slope * ageYears;
    return Math.abs(p.y - expectedY);
  };

  const flatError = (p: typeof comps[0], multiple: number): number => {
    return Math.abs(p.y - (Math.log(multiple) + p.x));
  };

  const miss = (errors: number[]): number => {
    if (errors.length === 0) return 0;
    return Math.exp(localMedian(errors));
  };

  const within = (errors: number[], factor: number): number => {
    if (errors.length === 0) return 0;
    const threshold = Math.log(factor);
    let count = 0;
    for (const e of errors) {
      if (e <= threshold) count++;
    }
    return count / errors.length;
  };

  const looModelErrors: number[] = [];
  const looFlatErrors: number[] = [];

  for (let i = 0; i < comps.length; i++) {
    const p = comps[i];
    const others = comps.filter((_, idx) => idx !== i);
    const base = localFit(others.map(c => ({ x: c.x, y: c.y })));
    const othersMultiples = others.map(c => c.multiple);
    const medianMultiple = localMedian(othersMultiples);

    const catFactor = (p.category !== null && p.category !== undefined && model.category_factors[p.category] !== undefined)
      ? model.category_factors[p.category]
      : 0;
    const clampedGrowth = Math.max(-30, Math.min(60, p.change_7d));
    const ageDaysVal = ageDays(snapshot.as_of, p.listed_at) ?? 0;
    const ageYears = ageDaysVal / 365.25;
    const expectedY = base.intercept + base.slope * p.x + catFactor + model.growth_slope * clampedGrowth + model.age_slope * ageYears;
    const mErr = Math.abs(p.y - expectedY);
    looModelErrors.push(mErr);

    const fErr = Math.abs(p.y - (Math.log(medianMultiple) + p.x));
    looFlatErrors.push(fErr);
  }

  const train = comps.filter(c => c.listed_at !== null && Date.parse(c.listed_at) < Date.parse('2025-01-01'));
  const test = comps.filter(c => c.listed_at !== null && Date.parse(c.listed_at) >= Date.parse('2025-01-01'));

  const timeModelErrors: number[] = [];
  const timeFlatErrors: number[] = [];

  if (train.length > 0 && test.length > 0) {
    const trainBase = localFit(train.map(c => ({ x: c.x, y: c.y })));
    const trainMultiples = train.map(c => c.multiple);
    const trainMedianMultiple = localMedian(trainMultiples);

    for (const p of test) {
      const catFactor = (p.category !== null && p.category !== undefined && model.category_factors[p.category] !== undefined)
        ? model.category_factors[p.category]
        : 0;
      const clampedGrowth = Math.max(-30, Math.min(60, p.change_7d));
      const ageDaysVal = ageDays(snapshot.as_of, p.listed_at) ?? 0;
      const ageYears = ageDaysVal / 365.25;
      const expectedY = trainBase.intercept + trainBase.slope * p.x + catFactor + model.growth_slope * clampedGrowth + model.age_slope * ageYears;
      timeModelErrors.push(Math.abs(p.y - expectedY));
      timeFlatErrors.push(Math.abs(p.y - (Math.log(trainMedianMultiple) + p.x)));
    }
  }

  return {
    loo_miss: miss(looModelErrors),
    loo_within3: within(looModelErrors, 3),
    loo_within10: within(looModelErrors, 10),
    loo_n: comps.length,
    time_miss: miss(timeModelErrors),
    time_within3: within(timeModelErrors, 3),
    time_n: test.length,
    flat_loo_miss: miss(looFlatErrors),
    flat_loo_within3: within(looFlatErrors, 3),
    flat_time_miss: miss(timeFlatErrors),
    flat_time_within3: within(timeFlatErrors, 3),
  };
}

// Gas cost estimator for farm chains
export function chainGas(chain: string): number {
  const c = (chain || '').toLowerCase();
  if (c.includes('ethereum') || c.includes('eth')) return 8;
  if (
    c.includes('base') ||
    c.includes('arbitrum') ||
    c.includes('optimism') ||
    c.includes('unichain') ||
    c.includes('katana') ||
    c.includes('morph') ||
    c.includes('ink') ||
    c.includes('plasma') ||
    c.includes('avalanche') ||
    c.includes('berachain') ||
    c.includes('arc') ||
    c.includes('tempo')
  ) return 0.5;
  if (
    c.includes('solana') ||
    c.includes('sui') ||
    c.includes('aptos') ||
    c.includes('monad') ||
    c.includes('hyperliquid')
  ) return 0.1;
  if (
    c.includes('bnb') ||
    c.includes('binance') ||
    c.includes('stable')
  ) return 0.3;
  if (c.includes('polygon')) return 0.2;
  return 2;
}

export function chainOf(p: any): string {
  return p?.chains?.[0] ?? 'its main chain';
}

export function holdDaysFor(age: number | null): number {
  if (age === null || age === undefined) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export type FarmVerdict = 'FARM' | 'THIN' | 'SKIP';

export interface FarmPlan {
  verdict: FarmVerdict;
  slice_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  work_hours: number;
  gas_usd: number;
  fees_usd: number;
  forgone_usd: number;
  capital_usd: number;
  hold_days: number;
  steps: FarmStep[];
}

export function actionFor(p: any, capital: number, chain: string): string {
  const cat = (p?.category || '').toLowerCase();
  const name = p?.name || 'Protocol';
  if (cat.includes('lend') || cat.includes('cdp') || cat.includes('collateral')) {
    return `Supply USDC as collateral with $${capital} and borrow a small amount against it through ${name} on ${chain}.`;
  }
  if (cat.includes('dex') || cat.includes('amm')) {
    return `Provide $${capital} of USDC liquidity in the most active pool through ${name} on ${chain}.`;
  }
  if (cat.includes('bridge')) {
    return `Bridge $${capital} of USDC to ${chain} and back through ${name}, keeping the receipts.`;
  }
  if (cat.includes('staking') || cat.includes('restak')) {
    return `Stake $${capital} of the chain asset through ${name} on ${chain}.`;
  }
  if (cat.includes('perpetual') || cat.includes('derivative') || cat.includes('options') || cat.includes('futures')) {
    return `Deposit $${capital} of margin and open a small hedged position through ${name} on ${chain}.`;
  }
  if (cat.includes('prediction')) {
    return `Fund a $${capital} position in an open market through ${name} on ${chain}.`;
  }
  if (cat.includes('curator') || cat.includes('allocator')) {
    return `Deposit $${capital} into a vault through ${name} on ${chain}.`;
  }
  if (cat.includes('stable')) {
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  }
  if (cat.includes('rwa')) {
    return `Mint $${capital} of the yield asset through ${name} on ${chain}.`;
  }
  if (cat.includes('insurance')) {
    return `Buy $${capital} of cover through ${name} on ${chain}.`;
  }
  if (cat.includes('yield') || cat.includes('leveraged farm') || cat.includes('vault')) {
    return `Deposit $${capital} into the highest-yield vault through ${name} on ${chain}.`;
  }
  return `Deposit $${capital} of USDC through ${name} on ${chain}.`;
}

export function weeklyFor(p: any): string {
  const cat = (p?.category || '').toLowerCase();
  const name = p?.name || 'Protocol';
  if (cat.includes('lend') || cat.includes('cdp') || cat.includes('collateral')) {
    return `Repay borrow interest and top up the supply position if the borrow rate rises.`;
  }
  if (cat.includes('dex') || cat.includes('amm')) {
    return `Rebalance the liquidity position into the active price range and collect fees.`;
  }
  if (cat.includes('bridge')) {
    return `Make one small bridge in each direction and keep the receipts.`;
  }
  if (cat.includes('staking') || cat.includes('restak')) {
    return `Check the stake is still delegated and restake any rewards.`;
  }
  if (cat.includes('perpetual') || cat.includes('derivative') || cat.includes('options') || cat.includes('futures')) {
    return `Close and reopen the hedged position once to keep it active.`;
  }
  if (cat.includes('prediction')) {
    return `Adjust the market position as odds move and keep the stake on.`;
  }
  if (cat.includes('curator') || cat.includes('allocator')) {
    return `Check the vault allocation and move to the best vault if it changed.`;
  }
  if (cat.includes('stable')) {
    return `Check the peg and top up the stable deposit if it drifted.`;
  }
  if (cat.includes('rwa')) {
    return `Check the yield accrual and keep the asset held.`;
  }
  if (cat.includes('insurance')) {
    return `Check the cover is still active and renew if it lapses.`;
  }
  if (cat.includes('yield') || cat.includes('leveraged farm') || cat.includes('vault')) {
    return `Harvest and redeposit yield once a week.`;
  }
  return `Perform one qualifying action each week according to ${name}'s published requirements.`;
}

export function farmSteps(
  p: any,
  capital: number,
  hold_days: number,
  gas: number = chainGas(chainOf(p)),
  fees: number = 2
): FarmStep[] {
  const chain = chainOf(p);
  const name = p?.name || 'Protocol';
  const forgone = capital * 0.04 * (hold_days / 365);
  return [
    {
      text: `Create a fresh wallet for ${name} on ${chain} and fund its capital and gas budget.`,
      cost: `$${capital} capital; $${gas} total gas budget; $${fees} total fees over ${hold_days} days`,
      time: `5 minutes of setup before the ${hold_days}-day hold`
    },
    {
      text: actionFor(p, capital, chain),
      cost: `Entry gas $${(gas * 0.4).toFixed(2)} of the $${gas} gas budget; use the existing capital allocation`,
      time: `10 minutes to enter, then hold for ${hold_days} days`
    },
    {
      text: weeklyFor(p),
      cost: `Weekly gas $${(gas * 0.25).toFixed(2)} of the $${gas} gas budget; reuse capital`,
      time: `10.2 minutes each week during ${hold_days} days`
    },
    {
      text: `Hold the $${capital} position in ${name} for ${hold_days} days.`,
      cost: `$${forgone.toFixed(2)} forgone yield at 4% annually; $${fees} total fees over ${hold_days} days`,
      time: `${hold_days} elapsed days; no additional active work beyond weekly checks`
    },
    {
      text: `Claim only from ${name}'s own published link when a claim is available.`,
      cost: `Claim gas $${(gas * 0.2).toFixed(2)} of the $${gas} gas budget`,
      time: `5.1 minutes when available after the ${hold_days}-day hold`
    },
    {
      text: `Keep a farm log for ${name} with transaction links, dates, costs and any claim proceeds.`,
      cost: `$0 additional logging cost`,
      time: `5.1 minutes total to maintain the log across ${hold_days} days`
    }
  ];
}

export function farmPlan(p: any, implied_value_usd: number, age_days: number | null): FarmPlan {
  const capital_usd = 1000;
  const hold_days = holdDaysFor(age_days);
  const gas_usd = chainGas(chainOf(p));
  const fees_usd = 2;
  const tvl = p?.tvl_usd ?? p?.tvl ?? 1;
  const slice_usd = implied_value_usd * 0.10 * (1000 / (tvl > 0 ? tvl : 1));
  const forgone_usd = capital_usd * 0.04 * (hold_days / 365);
  const work_hours = 0.25 + 0.17 * (hold_days / 7) + 0.17;
  const net_usd = slice_usd - gas_usd - fees_usd - forgone_usd;
  const net_per_hour_usd = net_usd / work_hours;
  const verdict: FarmVerdict = net_per_hour_usd >= 1 ? 'FARM' : net_usd > 0 ? 'THIN' : 'SKIP';
  const steps = farmSteps(p, capital_usd, hold_days, gas_usd, fees_usd);
  return {
    verdict,
    slice_usd,
    net_usd,
    net_per_hour_usd,
    work_hours,
    gas_usd,
    fees_usd,
    forgone_usd,
    capital_usd,
    hold_days,
    steps
  };
}

export function stepText(step: FarmStep): string {
  let base = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (base.length < 20) {
    base += ` Hold the position and check the protocol's own page.`;
  }
  if (base.length > 600) {
    base = base.slice(0, 597) + '...';
  }
  return base;
}

export const EARLY_ROWS = 160;

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  model: {
    base_usd: number;
    category_multiplier: number;
    growth_multiplier: number;
    age_multiplier: number;
    sibling_multiplier: number;
    age_days: number | null;
  };
  verdict: FarmVerdict;
  slice_usd: number;
  net_per_hour_usd: number;
  gas_usd: number;
  capital_usd: number;
  farm_steps: string[];
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

export function isPreToken(p: Protocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function isRankable(p: Protocol): boolean {
  return (
    isPreToken(p) &&
    p.category !== 'CEX' &&
    !VERSIONED.test(p.name) &&
    (p.category === null || !p.category.toLowerCase().includes('stablecoin')) &&
    !/^(wrapped|staked|bridged)\s/i.test(p.name)
  );
}

export function familyOf(name: string): string {
  return name.replace(VERSIONED, '').trim().toLowerCase();
}

export function siblingFactors(snapshot: Snapshot): Map<string, number> {
  const familyMembers = new Map<string, Protocol[]>();
  for (const p of snapshot.protocols) {
    const fam = familyOf(p.name);
    let list = familyMembers.get(fam);
    if (!list) {
      list = [];
      familyMembers.set(fam, list);
    }
    list.push(p);
  }
  const factors = new Map<string, number>();
  for (const list of familyMembers.values()) {
    const factor = 1 / (1 + 0.5 * (list.length - 1));
    for (const p of list) {
      factors.set(p.slug, factor);
    }
  }
  return factors;
}

function wholeDollar(v: number): number {
  return Math.max(1, Math.round(v));
}

function cents(v: number): number {
  return Math.round(v * 100) / 100;
}

// Build the ranked board rows from snapshot data and model fit
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const model = fitModel(snapshot);
  const siblings = siblingFactors(snapshot);

  const chosen = new Map<string, Protocol>();
  for (const slug of snapshot.watchlist) {
    const p = snapshot.protocols.find(proto => proto.slug === slug);
    if (p) {
      chosen.set(slug, p);
    }
  }

  const early = snapshot.protocols
    .filter(p => isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => {
      if (b.tvl_usd !== a.tvl_usd) {
        return b.tvl_usd - a.tvl_usd;
      }
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, EARLY_ROWS);

  for (const p of early) {
    chosen.set(p.slug, p);
  }

  const scored: Array<{ p: Protocol; age: number | null; sibling: number; implied: { value: number; low: number; high: number }; plan: any }> = [];

  for (const p of chosen.values()) {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const sibling = siblings.get(p.slug) ?? 1;
    const implied = impliedValue(p, model, snapshot.as_of, sibling);
    const plan = farmPlan(p, implied.value, age);
    scored.push({ p, age, sibling, implied, plan });
  }

  scored.sort((a, b) => {
    if (b.implied.value !== a.implied.value) {
      return b.implied.value - a.implied.value;
    }
    return a.p.slug.localeCompare(b.p.slug);
  });

  return scored.map((item, index) => {
    const { p, age, sibling, implied, plan } = item;
    const lnTvl = p.tvl_usd > 0 ? Math.log(p.tvl_usd) : 0;
    const catFactor = p.category === null ? 0 : (model.category_factors[p.category] ?? 0);
    const growthClamp = Math.max(-30, Math.min(60, p.change_7d ?? 0));
    const ageVal = age ?? 0;

    return {
      ...p,
      rank: index + 1,
      token_status: 'pre-token',
      age_days: age,
      implied_value_usd: wholeDollar(implied.value),
      implied_low_usd: wholeDollar(implied.low),
      implied_high_usd: wholeDollar(implied.high),
      model: {
        base_usd: Math.exp(model.intercept + model.slope * lnTvl),
        category_multiplier: Math.exp(catFactor),
        growth_multiplier: Math.exp(model.growth_slope * growthClamp),
        age_multiplier: Math.exp(model.age_slope * ageVal / 365.25),
        sibling_multiplier: sibling,
        age_days: age,
      },
      verdict: plan.verdict,
      slice_usd: cents(plan.slice_usd),
      net_per_hour_usd: cents(plan.net_per_hour_usd),
      gas_usd: plan.gas_usd,
      capital_usd: plan.capital_usd,
      farm_steps: plan.steps.map(stepText),
    };
  });
}
export const LIVE_ROWS = 24;

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  verdict: FarmVerdict;
  slice_usd: number;
  net_per_hour_usd: number;
  gas_usd: number;
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  backtest: BacktestResult;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  farm_counts: { farm: number; thin: number; skip: number };
  yardstick: { category: string; comps: number; median_multiple: number; factor: number }[];
  rows: RadarRow[];
  live: LiveRow[];
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  const filtered = snapshot.protocols.filter(p => !isPreToken(p) && p.category !== 'CEX');
  filtered.sort((a, b) => {
    const mcapA = a.mcap_usd ?? 0;
    const mcapB = b.mcap_usd ?? 0;
    if (mcapB !== mcapA) {
      return mcapB - mcapA;
    }
    return b.tvl_usd - a.tvl_usd;
  });
  return filtered.slice(0, LIVE_ROWS).map(p => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: [...p.chains],
    tvl_usd: p.tvl_usd,
    mcap_usd: p.mcap_usd,
    change_7d: p.change_7d,
  }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: [...row.chains],
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    verdict: row.verdict,
    slice_usd: row.slice_usd,
    net_per_hour_usd: row.net_per_hour_usd,
    gas_usd: row.gas_usd,
    farm_steps: [...row.farm_steps],
  };
}

// Construct radar data package and summary statistics
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const model = fitModel(snapshot);
  const backtest = backtestModel(snapshot, model);
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);

  const farm_counts = { farm: 0, thin: 0, skip: 0 };
  for (const row of board) {
    if (row.verdict === 'FARM') farm_counts.farm++;
    else if (row.verdict === 'THIN') farm_counts.thin++;
    else if (row.verdict === 'SKIP') farm_counts.skip++;
  }

  const early_size = board.filter(row => !snapshot.watchlist.includes(row.slug)).length;

  const stablecoins = new Set(['usdt', 'usdc', 'dai', 'usde', 'usdd', 'frax']);
  const comps = snapshot.protocols.filter(p => {
    if (typeof p.mcap_usd !== 'number' || !Number.isFinite(p.mcap_usd) || p.mcap_usd <= 0) return false;
    if (typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd) || p.tvl_usd <= 0) return false;
    const cat = p.category ? p.category.toLowerCase() : '';
    if (cat === 'cex') return false;
    if (cat.includes('stablecoin')) return false;
    const sym = p.symbol ? p.symbol.toLowerCase() : '';
    const name = p.name ? p.name.toLowerCase() : '';
    if (stablecoins.has(sym) || stablecoins.has(name)) return false;
    return true;
  });

  const catGroups = new Map<string, number[]>();
  for (const p of comps) {
    if (p.category !== null && p.category !== undefined) {
      const cat = p.category;
      let list = catGroups.get(cat);
      if (!list) {
        list = [];
        catGroups.set(cat, list);
      }
      list.push(p.mcap_usd! / p.tvl_usd!);
    }
  }

  const yardstick: { category: string; comps: number; median_multiple: number; factor: number }[] = [];
  for (const [category, multiples] of catGroups.entries()) {
    const compsCount = multiples.length;
    const median_multiple = median(multiples);
    const factor = model.category_factors[category] ?? 0;
    yardstick.push({
      category,
      comps: compsCount,
      median_multiple,
      factor,
    });
  }
  yardstick.sort((a, b) => b.median_multiple - a.median_multiple);

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    backtest,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size,
    live_size: live.length,
    farm_counts,
    yardstick,
    rows: board.map(radarRow),
    live,
  };

  return { board, radar };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const boardSlugs = new Set(board.map(r => r.slug));
  const missingWatchlist = snapshot.watchlist.filter(w => !boardSlugs.has(w));
  if (missingWatchlist.length > 0) {
    const firstMissing = missingWatchlist[0];
    const count = missingWatchlist.length;
    const firstFive = missingWatchlist.slice(0, 5).join(', ');
    return `Watchlist slug ${firstMissing}: ${count} watchlist slugs missing from board (first five: ${firstFive})`;
  }

  for (let i = 0; i < board.length; i++) {
    const row = board[i];
    if (row.rank !== i + 1) {
      return `slug ${row.slug}: invalid rank ${row.rank}, expected ${i + 1}`;
    }
  }

  for (let i = 0; i < board.length - 1; i++) {
    const currRow = board[i];
    const nextRow = board[i + 1];
    if (nextRow.implied_value_usd > currRow.implied_value_usd) {
      const curr = currRow.implied_value_usd;
      const next = nextRow.implied_value_usd;
      return `slug ${nextRow.slug}: implied value increased from ${curr} at rank ${currRow.rank} to ${next} at rank ${nextRow.rank}`;
    }
  }

  if (board.length >= 2) {
    const firstRow = board[0];
    const lastRow = board[board.length - 1];
    const first = firstRow.implied_value_usd;
    const last = lastRow.implied_value_usd;
    if (first === last) {
      return `slug ${lastRow.slug}: first implied value (${first}) equals last implied value (${last})`;
    }
  }

  for (const row of board) {
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) {
      return `slug ${row.slug}: farm_steps count ${row.farm_steps.length} out of range [3, 12]`;
    }
    for (const step of row.farm_steps) {
      if (step.length < 20 || step.length > 600) {
        return `slug ${row.slug}: farm_step length ${step.length} out of range [20, 600]`;
      }
    }
  }

  for (const row of board) {
    const v = row.implied_value_usd;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) {
      return `slug ${row.slug}: invalid implied_value_usd ${v} (must be safe integer above zero)`;
    }
  }

  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}


