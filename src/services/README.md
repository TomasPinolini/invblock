# Services

This directory is reserved for external API integrations.

## Planned Integrations

### Price Services

```
src/services/prices/
├── iol.ts        → IOL API for CEDEARs & ARG stocks
├── yahoo.ts      → Yahoo Finance for US stocks
├── binance.ts    → Binance for crypto
└── index.ts      → Unified PriceService interface
```

### Example Interface

```typescript
interface PriceService {
  getTicker(symbol: string): Promise<TickerPrice>;
  getBatch(symbols: string[]): Promise<Map<string, TickerPrice>>;
  subscribe(symbol: string, callback: (price: TickerPrice) => void): () => void;
}

interface TickerPrice {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  updatedAt: Date;
}
```

## Implementation Notes

1. Replace `MOCK_PRICES` in `src/lib/constants.ts` with real API calls
2. Use TanStack Query for caching and automatic refetching
3. Consider rate limits and API quotas
4. Add error handling and fallbacks
