/**
 * Network peer configuration for Saito mobile app.
 *
 * Change the peers array to connect to different Saito nodes.
 * After changing, run: npm run build-bridge
 */

module.exports = {
  // Active peer configuration
  peers: [
    // Local development node
    { host: 'localhost', port: 12101, protocol: 'http', synctype: 'lite' },

    // Live production network (uncomment to use)
    // { host: 'saito.io', port: 443, protocol: 'https', synctype: 'lite' },
  ],

  // SPV mode settings
  spv_mode: true,
  browser_mode: true,
};
