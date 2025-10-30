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
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserProfile, Message, Chat } from '../../models/models';
import { Subscription } from 'rxjs';
import { FirebaseService } from '../../services/firebase';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit {
  private chatService = inject(FirebaseService);

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

  newMessage = signal<string>('');
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
      if (this.selectedChat() || this.selectedUser()) {
        const currentUser = this.currentUser().uid;
        const other = this.selectedUser()?.uid;
        const chatId = this.chatService.getOrCreateChat(currentUser, other);
        this.typingState(chatId);
        this.newMessage.set('');
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
    this.chatService
      .getChat(chatId)
      .pipe(takeUntilDestroyed())
      .subscribe((chat) => {
        this.typingstatus.set(chat.typing);
        this.scrollToBottom();
      });
  }

  ngOnInit() {
    this.subscription.add(
      this.chatService.currentUser$.pipe(takeUntilDestroyed()).subscribe((user) => {
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

  async logout() {
    try {
      await this.chatService.signOut();
    } catch (error) {
      console.error('Logout error:', error);
      this.errorMessage = 'Failed to logout';
    }
  }

  loadUsers() {
    this.subscription.add(
      this.chatService
        .getOnlineUsers()
        .pipe(takeUntilDestroyed())
        .subscribe((users) => {
          this.onlineUsers.set(users);
        })
    );

    this.subscription.add(
      this.chatService
        .getAllUsers()
        .pipe(takeUntilDestroyed())
        .subscribe((users) => {
          const otherUsers = users.filter((user) => user.uid !== this.currentUser()?.uid);
          this.users.set(otherUsers);
        })
    );
  }

  loadChats() {
    this.subscription.add(
      this.chatService
        .getUserChats()
        .pipe(takeUntilDestroyed())
        .subscribe((chats) => {
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
      this.chatService
        .getPrivateMessages(otherUserId)
        .pipe(takeUntilDestroyed())
        .subscribe((messages) => {
          this.newMessage.set('');

          this.messages.set(messages);

          setTimeout(() => {
            this.scrollToBottom();
          }, 100);
        })
    );
  }

  async sendMessage() {
    if (this.newMessage().trim() && this.selectedUser()) {
      this.stoptyping();
      try {
        const result = await this.chatService.sendPrivateMessage(
          this.selectedUser()!.uid,
          this.newMessage().trim()
        );

        this.loadChats();

        this.scrollToBottom();
      } catch (error: any) {
        alert('Failed to send message: ' + error);
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
}
