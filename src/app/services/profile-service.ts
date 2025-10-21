import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  updateProfile,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable, from, map, switchMap } from 'rxjs';
import { UserProfile, UpdateProfileData } from '../models/models';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private storage = inject(Storage);

  // الحصول على بيانات الملف الشخصي
  getUserProfile(uid: string): Observable<UserProfile | null> {
    const userDocRef = doc(this.firestore, 'users', uid);
    return from(getDoc(userDocRef)).pipe(
      map((snapshot) => {
        if (snapshot.exists()) {
          return snapshot.data() as UserProfile;
        }
        return null;
      })
    );
  }

  // تحديث الملف الشخصي
  async updateUserProfile(
    uid: string,
    data: UpdateProfileData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);

      await updateDoc(userDocRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });

      const currentUser = this.auth.currentUser;
      if (currentUser && (data.displayName || data.photoURL)) {
        await updateProfile(currentUser, {
          displayName: data.displayName || currentUser.displayName,
        });
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
  }

  // تغيير كلمة المرور
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.auth.currentUser;
      if (!user || !user.email) {
        return { success: false, error: 'User not authenticated' };
      }

      // إعادة المصادقة أولاً
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // تغيير كلمة المرور
      await updatePassword(user, newPassword);

      return { success: true };
    } catch (error: any) {
      console.error('Error changing password:', error);
      return { success: false, error: this.getAuthErrorMessage(error) };
    }
  }

  // تغيير البريد الإلكتروني
  async changeEmail(
    newEmail: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.auth.currentUser;
      if (!user || !user.email) {
        return { success: false, error: 'User not authenticated' };
      }

      // إعادة المصادقة
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // تغيير البريد الإلكتروني
      await updateEmail(user, newEmail);

      // تحديث في Firestore
      const userDocRef = doc(this.firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
        email: newEmail,
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error changing email:', error);
      return { success: false, error: this.getAuthErrorMessage(error) };
    }
  }

  // رسائل الأخطاء
  private getAuthErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/wrong-password':
        return 'كلمة المرور الحالية غير صحيحة';
      case 'auth/weak-password':
        return 'كلمة المرور الجديدة ضعيفة جداً';
      case 'auth/email-already-in-use':
        return 'البريد الإلكتروني مستخدم بالفعل';
      case 'auth/invalid-email':
        return 'البريد الإلكتروني غير صالح';
      case 'auth/requires-recent-login':
        return 'يجب تسجيل الدخول مرة أخرى لإكمال هذه العملية';
      default:
        return error.message || 'حدث خطأ غير متوقع';
    }
  }
}
