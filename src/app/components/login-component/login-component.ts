import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseService } from '../../services/firebase';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from '@angular/fire/auth';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-component.html',
  styleUrls: ['./login-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private chatService = inject(FirebaseService);
  private auth = inject(Auth);

  currentUser = signal<any>(null);
  isLoggedIn = signal(false);
  showPassword = false;

  newMessage = '';
  authEmail = '';
  authPassword = '';
  isRegistering = false;
  isLoading = false;
  displayName = '';
  errorMessage = '';
  constructor(private toast: ToastrService, private router: Router) {}
  ngOnInit() {
    this.chatService.currentUser$.pipe(takeUntilDestroyed()).subscribe((user) => {
      this.currentUser.set(user);
    });
  }

  // Missing methods - Add these:
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
      console.log(error.code);

      this.errorMessage = this.getAuthErrorMessage(error);

      this.toast.error(this.errorMessage);
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
    this.router.navigate(['/chat']);

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
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      this.toast.success('logged in succesfully');
      this.authEmail = '';
      this.authPassword = '';
      this.router.navigate(['/chat']);
    } catch (error: any) {
      throw error;
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
      case 'auth/invalid-credential':
        return 'invalid credentials .';
      default:
        return `Authentication failed: ${error.message}`;
    }
  }

  toggleRegister() {
    this.isRegistering = !this.isRegistering;
    this.errorMessage = '';
  }
}
