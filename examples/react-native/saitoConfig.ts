import type Configs from 'saito-js/configs';

export const DEFAULT_SAITO_CONFIG: Configs = {
  server: {
    host: 'localhost',
    port: 12101,
    protocol: 'http',
    endpoint: {
      host: 'localhost',
      port: 12101,
      protocol: 'http'
    },
    verification_threads: 4,
    channel_size: 1_000_000,
    stat_timer_in_ms: 5_000,
    reconnection_wait_time: 10_000,
    thread_sleep_time_in_ms: 10,
    block_fetch_batch_size: 100
  },
  peers: [
    {
      host: 'lite.saito.io',
      port: 443,
      protocol: 'wss',
      synctype: 'full'
    }
  ],
  spv_mode: true,
  browser_mode: true,
  consensus: {
    genesis_period: 80_640,
    heartbeat_interval: 30_000,
    prune_after_blocks: 99,
    max_staker_recursions: 3
  }
};

export const STORAGE_KEYS = {
  PRIVATE_KEY: '@saito/react-native/private-key',
  PUBLIC_KEY: '@saito/react-native/public-key',
  WALLET_META: '@saito/react-native/wallet-meta'
};

export const DEMO_REQUEST = 'react-native-demo';
