export interface Message {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  timestamp: any;
  chatId: string; // Unique ID for the chat between two users
  type: 'private' | 'group';
}

export interface Chat {
  id: string;
  participantIds: string[];
  participantNames: string[];
  lastMessage?: string;
  lastMessageTime?: any;
  unreadCount?: number;
  typing: { userId: string; state: boolean };
}
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  bio?: string;
  createdAt: any;
  lastLoginAt: any;
  isOnline: boolean;
  status?: 'online' | 'away' | 'busy' | 'offline';
}

export interface UpdateProfileData {
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  bio?: string;
  status?: string;
}
