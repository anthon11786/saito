// RN -> WebView commands
export type BridgeCommand = {
  id: string;
  module: 'core' | 'wallet' | 'chat' | string;
  method: string;
  params?: Record<string, any>;
};

// WebView -> RN responses
export type BridgeResponse = {
  id: string;
  result?: any;
  error?: string;
};

// WebView -> RN events (unsolicited, from any module)
export type BridgeEvent = {
  type: 'event';
  module: 'core' | 'wallet' | 'chat' | string;
  event: string;
  data: any;
};

export type BridgeMessage = BridgeResponse | BridgeEvent;

// === Core module methods ===
// core.init           -> { privateKey?: string }
// core.getPeers       -> PeerInfo[]
// core.getBlockchainInfo -> { blockId: string, blockHash: string }

// === Wallet module methods ===
// wallet.getPublicKey              -> string
// wallet.getPrivateKey             -> string
// wallet.getBalance                -> string (nolan)
// wallet.createAndSendTransaction  -> { recipient: string, amount: string }
// wallet.generateNewWallet         -> { publicKey: string, privateKey: string }
// wallet.setPrivateKey             -> { privateKey: string }

// === Chat module methods ===
// chat.getGroups           -> ChatGroup[]
// chat.getMessages         -> { groupId: string } -> ChatMessage[]
// chat.sendMessage         -> { groupId: string, message: string }
// chat.createGroup         -> { name?: string, members: string[] } -> string (groupId)
// chat.getOlderMessages    -> { groupId: string, beforeTimestamp: number } -> ChatMessage[]
// chat.markRead            -> { groupId: string }

// === Core events ===
// core.block-added         -> { hash: string, blockId: string }
// core.peer-connected      -> { count: number }
// core.version-mismatch    -> { requiredVersion: string, peerIndex: string, source: 'handshake' }
// core.node-version        -> { saito_js: string, build_number: number, wallet_version: number }

// === Wallet events ===
// wallet.balance-updated   -> { balance: string }

// === Chat events ===
// chat.new-message         -> { groupId: string, message: ChatMessage }
// chat.group-updated       -> { group: ChatGroup }
// chat.unread-updated      -> { groupId: string, count: number }
