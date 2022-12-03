import { Chain } from "@defillama/sdk/build/general";
import { BreakdownAdapter, FetchResultGeneric, BaseAdapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import { getStartTimestamp } from "../../helpers/getStartTimestamp";

import {
  getGraphDimensions,
  DEFAULT_DAILY_VOLUME_FACTORY,
  DEFAULT_TOTAL_VOLUME_FIELD,
} from "../../helpers/getUniSubgraph"

const v1Endpoints = {
  [CHAIN.ETHEREUM]: "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap",
};

const v2Endpoints = {
  [CHAIN.ETHEREUM]: "https://api.thegraph.com/subgraphs/name/ianlapham/uniswapv2",
};

const v3Endpoints = {
  [CHAIN.ETHEREUM]: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
  [CHAIN.OPTIMISM]:
    "https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis",
  [CHAIN.ARBITRUM]:
    "https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-dev",
  [CHAIN.POLYGON]:
    "https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon",
};

const VOLUME_USD = "volumeUSD";

// fees results are in eth, needs to be converted to a balances objects
const ETH_ADDRESS = "ethereum:0x0000000000000000000000000000000000000000";
const v1Graph = getGraphDimensions({
  graphUrls: v1Endpoints,
  totalVolume: {
    factory: "uniswaps",
  },
  dailyVolume: {
    field: "dailyVolumeInUSD",
  },
  dailyFees: {
    factory: "exchangeHistoricalData",
    field: "feeInEth"
  },
  feesPercent: {
    type: "fees",
    UserFees: 100,
    ProtocolRevenue: 0,
    SupplySideRevenue: 100,
    HoldersRevenue: 0,
    Revenue: 100,
    Fees: 100
  }
});

const v2Graph = getGraphDimensions({
  graphUrls: v2Endpoints,
  feesPercent: {
    type: "volume",
    UserFees: 0.3,
    ProtocolRevenue: 0,
    SupplySideRevenue: 0.3,
    HoldersRevenue: 0,
    Revenue: 0.3,
    Fees: 0.3
  }
});

const v3Graphs = getGraphDimensions({
  graphUrls: v3Endpoints,
  totalVolume: {
    factory: "factories",
    field: DEFAULT_TOTAL_VOLUME_FIELD,
  },
  dailyVolume: {
    factory: DEFAULT_DAILY_VOLUME_FACTORY,
    field: VOLUME_USD,
  },
  feesPercent: {
    type: "fees",
    ProtocolRevenue: 0,
    HoldersRevenue: 0,
    UserFees: 100, // User fees are 100% of collected fees
    SupplySideRevenue: 100, // 100% of fees are going to LPs
    Revenue: 100 // Revenue is 100% of collected fees
  }
});

const methodology = {
  UserFees: "User pays 0.3% fees on each swap.",
  ProtocolRevenue: "Protocol have no revenue.",
  SupplySideRevenue: "All user fees are distributed among LPs.",
  HoldersRevenue: "Holders have no revenue."
}

const adapter: BreakdownAdapter = {
  breakdown: {
    v1: {
      [CHAIN.ETHEREUM]: {
        fetch: async (timestamp, chainBlocks) => {
          const response = await v1Graph(CHAIN.ETHEREUM)(timestamp, chainBlocks)
          return {
            ...response,
            ...["dailyUserFees", "dailyProtocolRevenue", "dailySupplySideRevenue", "dailyHoldersRevenue", "dailyRevenue", "dailyFees"].reduce((acc, resultType) => {
              const valueInEth = response[resultType]
              if (typeof valueInEth === 'string')
                acc[resultType] = {
                  [ETH_ADDRESS]: valueInEth
                }
              return acc
            }, {} as FetchResultGeneric)
          } as FetchResultGeneric
        },
        start: async () => 1541203200,
        meta: {
          methodology
        },
      },
    },
    v2: {
      [CHAIN.ETHEREUM]: {
        fetch: v2Graph(CHAIN.ETHEREUM),
        start: getStartTimestamp({
          endpoints: v2Endpoints,
          chain: CHAIN.ETHEREUM,
        }),
        meta: {
          methodology
        },
      },
    },
    v3: Object.keys(v3Endpoints).reduce((acc, chain) => {
      acc[chain] = {
        fetch: v3Graphs(chain as Chain),
        start: getStartTimestamp({
          endpoints: v3Endpoints,
          chain: chain,
          volumeField: VOLUME_USD,
        }),
        meta: {
          methodology: {
            ...methodology,
            UserFees: "User pays 0.05%, 0.30%, or 1% on each swap."
          }
        }
      }
      return acc
    }, {} as BaseAdapter)
  }
}

export default adapter;
