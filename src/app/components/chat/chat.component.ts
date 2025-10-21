import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  Renderer2,
  ViewChild,
  ElementRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserProfile, Message, Chat } from '../../models/models';
import { Subscription } from 'rxjs';
import { FirebaseService } from '../../services/firebase';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
})
export class ChatComponent implements OnInit, OnDestroy {
  private chatService = inject(FirebaseService);
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private subscription = new Subscription();

  users = signal<UserProfile[]>([]);
  onlineUsers = signal<UserProfile[]>([]);
  chats = signal<Chat[]>([]);
  messages = signal<Message[]>([]);
  currentUser = signal<any>(null);
  selectedUser = signal<any>(null);
  selectedChat = signal<Chat | null>(null);
  isLoggedIn = signal(false);
  chatView = signal(false);
  typingstatus = signal<{ userId: string; state: boolean } | null>(null);
  typingTimeout: any;

  newMessage = '';
  authEmail = '';
  authPassword = '';
  displayName = '';
  isRegistering = false;
  isLoading = false;
  errorMessage = '';
  activeTab = signal<'users' | 'chats'>('chats');
  @ViewChild('chatContainer', { static: true }) chatContainer!: ElementRef;
  constructor(private renderer2: Renderer2) {
    effect(() => {
      console.log(this.chatView());

      if (this.selectedChat() || this.selectedUser()) {
        const currentUser = this.currentUser().uid;
        const other = this.selectedUser()?.uid;
        const chatId = this.chatService.getOrCreateChat(currentUser, other);
        this.typingState(chatId);
        this.newMessage = '';
      }
    });
  }
  toggleToList() {
    this.renderer2.addClass(this.chatContainer.nativeElement, 'list-active');
    this.renderer2.removeClass(this.chatContainer.nativeElement, 'chat-active');
    this.chatView.set(false);
  }

  activateChatView() {
    this.renderer2.addClass(this.chatContainer.nativeElement, 'chat-active');
    this.renderer2.removeClass(this.chatContainer.nativeElement, 'list-active');
    this.chatView.set(true);
  }

  typing() {
    clearTimeout(this.typingTimeout);

    const currentUser = this.currentUser().uid;
    const other = this.selectedUser()?.uid;
    const chatId = this.chatService.getOrCreateChat(currentUser, other);
    console.log(currentUser, '????', other, '???', chatId);

    this.chatService.updateChatMetadata(
      chatId,
      currentUser,
      other,
      this.messages().length > 0 ? this.messages()[this.messages().length - 1]?.text : '',
      {
        userId: currentUser,
        state: true,
      }
    );
    this.typingTimeout = setTimeout(() => {
      this.stoptyping();
    }, 300);
  }
  stoptyping() {
    const currentUser = this.currentUser().uid;
    const other = this.selectedUser()?.uid;
    const chatId = this.chatService.getOrCreateChat(currentUser, other);

    this.chatService.updateChatMetadata(
      chatId,
      currentUser,
      other,
      this.messages().length > 0 ? this.messages()[this.messages().length - 1]?.text : '',
      {
        userId: currentUser,
        state: false,
      }
    );
  }

  typingState(chatId: string) {
    this.chatService.getChat(chatId).subscribe((chat) => {
      this.typingstatus.set(chat.typing);
      this.scrollToBottom();
    });
  }

  ngOnInit() {
    this.subscription.add(
      this.chatService.currentUser$.subscribe((user) => {
        this.currentUser.set(user);
        this.isLoggedIn.set(!!user);

        if (user) {
          this.loadUsers();
          this.loadChats();
        } else {
          this.users.set([]);
          this.chats.set([]);
          this.messages.set([]);
        }
      })
    );
  }

  async handleAuth() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      if (this.isRegistering) {
        await this.handleRegister();
      } else {
        await this.handleLogin();
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      this.errorMessage = this.getAuthErrorMessage(error);
    } finally {
      this.isLoading = false;
    }
  }

  private async handleRegister() {
    const email = this.authEmail;
    const password = this.authPassword;
    const displayName = this.displayName;

    if (!email || !password) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    if (password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters';
      return;
    }

    const { user } = await createUserWithEmailAndPassword(this.auth, email, password);

    if (displayName) {
      await updateProfile(user, { displayName });
    }

    await this.chatService.createUserProfile(user);

    this.authEmail = '';
    this.authPassword = '';
    this.displayName = '';
  }

  private async handleLogin() {
    const email = this.authEmail;
    const password = this.authPassword;

    if (!email || !password) {
      this.errorMessage = 'Please fill in email and password';
      return;
    }

    await signInWithEmailAndPassword(this.auth, email, password);

    this.authEmail = '';
    this.authPassword = '';
  }

  async logout() {
    try {
      await this.chatService.signOut();
    } catch (error) {
      console.error('Logout error:', error);
      this.errorMessage = 'Failed to logout';
    }
  }

  private getAuthErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'This email is already registered. Please login instead.';
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.';
      default:
        return `Authentication failed: ${error.message}`;
    }
  }

  toggleRegister() {
    this.isRegistering = !this.isRegistering;
    this.errorMessage = '';
  }

  loadUsers() {
    this.subscription.add(
      this.chatService.getOnlineUsers().subscribe((users) => {
        this.onlineUsers.set(users);
      })
    );

    this.subscription.add(
      this.chatService.getAllUsers().subscribe((users) => {
        const otherUsers = users.filter((user) => user.uid !== this.currentUser()?.uid);
        this.users.set(otherUsers);
      })
    );
  }

  loadChats() {
    this.subscription.add(
      this.chatService.getUserChats().subscribe((chats) => {
        this.chats.set(chats);
      })
    );
  }

  selectUser(user: UserProfile) {
    this.selectedUser.set(user);
    this.selectedChat.set(null);
    this.loadPrivateMessages(user.uid);
    this.activateChatView();
  }

  selectChat(chat: Chat) {
    this.selectedChat.set(chat);
    this.typingState(chat.id);
    const currentUserId = this.currentUser()?.uid;
    const otherParticipantId = chat.participantIds.find((id) => id !== currentUserId);

    if (otherParticipantId) {
      this.chatService.getUserProfile(otherParticipantId).then((user) => {
        this.selectedUser.set(user);
        this.loadPrivateMessages(otherParticipantId);
      });
    }
    this.activateChatView();
  }

  loadPrivateMessages(otherUserId: string) {
    this.subscription.add(
      this.chatService.getPrivateMessages(otherUserId).subscribe((messages) => {
        this.messages.set(messages);

        setTimeout(() => {
          this.scrollToBottom();
        }, 100);
      })
    );
  }

  async sendMessage() {
    if (this.newMessage.trim() && this.selectedUser()) {
      this.stoptyping();
      const result = await this.chatService.sendPrivateMessage(
        this.selectedUser()!.uid,
        this.newMessage.trim()
      );

      if (result.success) {
        this.newMessage = '';
        this.loadChats();

        this.scrollToBottom();
      } else {
        alert('Failed to send message: ' + result.error);
      }
    }
  }

  scrollToBottom() {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getDisplayName(chat: Chat): string {
    const currentUserId = this.currentUser()?.uid;
    const otherParticipantIndex = chat.participantIds.findIndex((id) => id !== currentUserId);
    return chat.participantNames[otherParticipantIndex] || 'Unknown User';
  }

  getLastMessagePreview(chat: Chat): string {
    if (!chat.lastMessage) return 'No messages yet';
    const maxLength = 30;
    return chat.lastMessage.length > maxLength
      ? chat.lastMessage.substring(0, maxLength) + '...'
      : chat.lastMessage;
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
