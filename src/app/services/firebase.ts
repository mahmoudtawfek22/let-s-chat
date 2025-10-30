import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  orderBy,
  query,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  where,
  onSnapshot,
  DocumentReference,
  docData,
} from '@angular/fire/firestore';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { Observable, map, BehaviorSubject, combineLatest } from 'rxjs';
import { Chat, Message, UserProfile } from '../models/models';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Track auth state
    onAuthStateChanged(this.auth, (user) => {
      this.currentUserSubject.next(user);
      if (user) {
        this.updateUserOnlineStatus(user.uid, true);
        this.createUserProfile(user);
      }
    });
  }

  // Get all users except current user
  getAllUsers(): Observable<UserProfile[]> {
    const usersRef = collection(this.firestore, 'users');
    return collectionData(usersRef, { idField: 'uid' }).pipe(
      map((users) => users as UserProfile[])
    );
  }

  // Get online users
  getOnlineUsers(): Observable<UserProfile[]> {
    return this.getAllUsers().pipe(
      map((users) =>
        users.filter((user) => user.isOnline && user.uid !== this.auth.currentUser?.uid)
      )
    );
  }

  // Update user online status
  async updateUserOnlineStatus(uid: string, isOnline: boolean) {
    const userDocRef = doc(this.firestore, 'users', uid);
    await updateDoc(userDocRef, {
      isOnline,
      lastLoginAt: isOnline ? serverTimestamp() : null,
    });
  }

  // Create or get chat between two users
  getOrCreateChat(user1Id: string, user2Id: string): string {
    // Create consistent chat ID (always sorted to avoid duplicates)
    const participants = [user1Id, user2Id].sort();
    return `private_${participants.join('_')}`;
  }

  // Send private message
  async sendPrivateMessage(
    receiverId: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }

      const chatId = this.getOrCreateChat(currentUser.uid, receiverId);
      const messagesRef = collection(this.firestore, 'messages');

      await addDoc(messagesRef, {
        text: text.trim(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
        senderEmail: currentUser.email,
        receiverId: receiverId,
        chatId: chatId,
        type: 'private',
        timestamp: serverTimestamp(),
        read: false,
      });

      // Update chat metadata
      await this.updateChatMetadata(chatId, currentUser.uid, receiverId, text, {
        userId: currentUser.uid,
        state: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error sending private message:', error);
      return { success: false, error: error.message };
    }
  }

  // Update chat metadata (last message, timestamp)
  async updateChatMetadata(
    chatId: string,
    senderId: string,
    receiverId: string,
    lastMessage: string,
    typing: { userId: string; state: boolean }
  ) {
    const chatRef = doc(this.firestore, 'chats', chatId);

    // Get user names for display
    const sender = await this.getUserProfile(senderId);
    const receiver = await this.getUserProfile(receiverId);

    await setDoc(
      chatRef,
      {
        id: chatId,
        participantIds: [senderId, receiverId],
        participantNames: [
          sender?.displayName || 'Unknown User',
          receiver?.displayName || 'Unknown User',
        ],
        lastMessage: lastMessage,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: senderId,
        updatedAt: serverTimestamp(),
        typing,
      },
      { merge: true }
    );
  }

  getChat(chatId: string): Observable<Chat> {
    const chatRef = doc(this.firestore, 'chats', chatId);

    // const ChatSnap = getDoc(chatRef);

    return docData(chatRef) as Observable<Chat>;
  }
  // Get private messages between two users
  getPrivateMessages(otherUserId: string): Observable<Message[]> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const chatId = this.getOrCreateChat(currentUser.uid, otherUserId);
    const messagesRef = collection(this.firestore, 'messages');
    const messagesQuery = query(
      messagesRef,
      where('chatId', '==', chatId),
      orderBy('timestamp', 'asc')
    );

    return collectionData(messagesQuery, { idField: 'id' }).pipe(
      map((messages) => messages as Message[])
    );
  }

  // Get all chats for current user
  getUserChats(): Observable<Chat[]> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const chatsRef = collection(this.firestore, 'chats');
    const chatsQuery = query(
      chatsRef,
      where('participantIds', 'array-contains', currentUser.uid),
      orderBy('lastMessageTime', 'desc')
    );

    return collectionData(chatsQuery, { idField: 'id' }).pipe(map((chats) => chats as Chat[]));
  }

  // Get user profile
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userDocRef = doc(this.firestore, 'users', uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    return null;
  }

  // Create user profile
  async createUserProfile(user: User) {
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      displayName: user.displayName || user.email!.split('@')[0],
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      photoURL: user.photoURL || '',
      isOnline: true,
    };

    const userDocRef = doc(this.firestore, 'users', user.uid);
    await setDoc(userDocRef, userProfile);
  }

  // Sign out with offline status update
  async signOut() {
    const user = this.auth.currentUser;
    if (user) {
      await this.updateUserOnlineStatus(user.uid, false);
    }
    return await this.auth.signOut();
  }
}
