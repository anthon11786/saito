export type ChatMessage = {
  id: string;
  groupId: string;
  sender: string;
  message: string;
  timestamp: number;
  sig: string;
};

export type ChatGroup = {
  id: string;
  name: string;
  members: string[];
  txs: ChatMessage[];
  unread: number;
  lastUpdate: number;
};
