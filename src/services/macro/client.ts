/**
 * Argentine macro data client.
 * Fetches key indicators from public APIs:
 *   - DolarAPI: Dollar rates (Blue, MEP, CCL, Official)
 *   - BCRA API: Interest rate, reserves, monthly CPI
 *   - Ambito: Country risk (EMBI+)
 *
 * All fetches have individual error handling — partial data is returned.
 */

export interface DollarRate {
  name: string;
  buy: number | null;
  sell: number | null;
  spread: number | null;
}

export interface MacroData {
  dollars: DollarRate[];
  interestRate: number | null;
  reserves: number | null;
  monthlyCpi: number | null;
  countryRisk: number | null;
  fetchedAt: string;
  errors: string[];
}

interface DolarApiResponse {
  compra: number;
  venta: number;
  nombre?: string;
}

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchDollarRates(): Promise<{ rates: DollarRate[]; errors: string[] }> {
  const errors: string[] = [];
  const rates: DollarRate[] = [];

  const endpoints = [
    { name: "Blue", url: "https://dolarapi.com/v1/dolares/blue" },
    { name: "MEP", url: "https://dolarapi.com/v1/dolares/bolsa" },
    { name: "CCL", url: "https://dolarapi.com/v1/dolares/contadoconliqui" },
    { name: "Official", url: "https://dolarapi.com/v1/dolares/oficial" },
  ];

  const results = await Promise.allSettled(
    endpoints.map(async ({ name, url }) => {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      const data: DolarApiResponse = await res.json();
      return {
        name,
        buy: data.compra ?? null,
        sell: data.venta ?? null,
        spread: data.compra && data.venta ? data.venta - data.compra : null,
      };
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      rates.push(result.value);
    } else {
      errors.push(`Dollar ${endpoints[i].name}: ${result.reason}`);
    }
  }

  return { rates, errors };
}

async function fetchBcraVariable(idVariable: number, label: string): Promise<{ value: number | null; error: string | null }> {
  try {
    const res = await fetchWithTimeout(
      `https://api.bcra.gob.ar/estadisticas/v2.0/datosvariable/${idVariable}/1/1`,
      5000
    );
    if (!res.ok) return { value: null, error: `${label}: HTTP ${res.status}` };
    const data = await res.json();
    const results = data?.results;
    if (!results || results.length === 0) return { value: null, error: `${label}: no data` };
    return { value: parseFloat(results[results.length - 1].valor), error: null };
  } catch (err) {
    return { value: null, error: `${label}: ${err}` };
  }
}

async function fetchCountryRisk(): Promise<{ value: number | null; error: string | null }> {
  try {
    const res = await fetchWithTimeout("https://dolarapi.com/v1/riesgo-pais", 5000);
    if (!res.ok) return { value: null, error: `Country risk: HTTP ${res.status}` };
    const data = await res.json();
    return { value: data?.valor ?? null, error: null };
  } catch (err) {
    return { value: null, error: `Country risk: ${err}` };
  }
}

/**
 * Fetch all macro data in parallel with individual error handling.
 */
export async function fetchMacroData(): Promise<MacroData> {
  const [
    dollarResult,
    interestResult,
    reservesResult,
    cpiResult,
    countryRiskResult,
  ] = await Promise.all([
    fetchDollarRates(),
    fetchBcraVariable(6, "Interest rate"),    // Tasa de política monetaria
    fetchBcraVariable(1, "Reserves"),          // Reservas internacionales
    fetchBcraVariable(27, "Monthly CPI"),      // IPC mensual
    fetchCountryRisk(),
  ]);

  const errors: string[] = [
    ...dollarResult.errors,
    ...(interestResult.error ? [interestResult.error] : []),
    ...(reservesResult.error ? [reservesResult.error] : []),
    ...(cpiResult.error ? [cpiResult.error] : []),
    ...(countryRiskResult.error ? [countryRiskResult.error] : []),
  ];

  return {
    dollars: dollarResult.rates,
    interestRate: interestResult.value,
    reserves: reservesResult.value,
    monthlyCpi: cpiResult.value,
    countryRisk: countryRiskResult.value,
    fetchedAt: new Date().toISOString(),
    errors,
  };
}
