import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { UserProfile, UpdateProfileData } from '../../models/models';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { ProfileService } from '../../services/profile-service';
import { RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  selector: 'app-profile-component',
  templateUrl: './profile-component.html',
  styleUrl: './profile-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  private auth = inject(Auth);
  private userProfileService = inject(ProfileService);
  private fb = inject(FormBuilder);

  userProfile = signal<UserProfile | null>(null);
  currentUser = signal<User | null>(null);
  isLoading = signal(false);
  activeTab = signal<'profile' | 'security' | 'appearance'>('profile');
  unSubscribe$ = new Subject<void>();

  isUploading = signal(false);

  profileForm: FormGroup;
  passwordForm: FormGroup;
  emailForm: FormGroup;

  constructor(private toast: ToastrService) {
    this.profileForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      bio: ['', [Validators.maxLength(200)]],
      phoneNumber: ['', [Validators.pattern(/^[0-9+\-() ]+$/)]],
      status: ['online'],
    });

    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', [Validators.required, Validators.minLength(6)]],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );

    this.emailForm = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.set(user);
      if (user) {
        this.loadUserProfile(user.uid);
      } else {
        this.userProfile.set(null);
      }
    });
  }

  loadUserProfile(uid: string) {
    this.isLoading.set(true);
    this.userProfileService
      .getUserProfile(uid)
      .pipe(takeUntil(this.unSubscribe$))
      .subscribe({
        next: (profile) => {
          if (profile) {
            this.userProfile.set(profile);
            this.profileForm.patchValue({
              displayName: profile.displayName,
              bio: profile.bio || '',
              phoneNumber: profile.phoneNumber || '',
              status: profile.status || 'online',
            });
          }
          this.isLoading.set(false);
        },
        error: (error) => {
          this.toast.error('Error loading profile: ' + error);
          this.isLoading.set(false);
        },
      });
  }

  async updateProfile() {
    if (this.profileForm.invalid || !this.currentUser()) return;

    this.isLoading.set(true);
    const formData = this.profileForm.value;
    console.log(this.profileForm.valid);

    try {
      const updateData: UpdateProfileData = {
        displayName: formData.displayName,
        bio: formData.bio,
        phoneNumber: formData.phoneNumber,
        status: formData.status,
      };
      const result = await this.userProfileService.updateUserProfile(
        this.currentUser()!.uid,
        updateData
      );

      if (result.success) {
        this.toast.success('Profile updated successfully');
        this.loadUserProfile(this.currentUser()?.uid ?? '');
      } else {
        this.toast.error('Failed to update profile: ' + result.error);
      }
    } catch (error: any) {
      this.toast.error(error.message);
    } finally {
      this.isLoading.set(false);
    }
  }

  async changePassword() {
    if (this.passwordForm.invalid) return;

    this.isLoading.set(true);
    const formData = this.passwordForm.value;

    const result = await this.userProfileService.changePassword(
      formData.currentPassword,
      formData.newPassword
    );

    if (result.success) {
      this.toast.success('Password changed successfully');
      this.passwordForm.reset();
    } else {
      this.toast.error('Failed to change password: ' + result.error);
    }

    this.isLoading.set(false);
  }

  async changeEmail() {
    if (this.emailForm.invalid) return;

    this.isLoading.set(true);
    const formData = this.emailForm.value;

    const result = await this.userProfileService.changeEmail(formData.newEmail, formData.password);

    if (result.success) {
      this.toast.success('Email changed successfully');
      this.emailForm.reset();
    } else {
      this.toast.error('Failed to change email: ' + result.error);
    }

    this.isLoading.set(false);
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  setActiveTab(tab: 'profile' | 'security' | 'appearance') {
    this.activeTab.set(tab);
  }

  getInitials(name: string): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  ngOnDestroy(): void {
    this.unSubscribe$.next();
    this.unSubscribe$.complete();
  }
}
