import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FirebaseService } from '../services/firebase';
import { Auth } from '@angular/fire/auth';

export const notAuthGuard: CanActivateFn = async (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  return new Promise<boolean>((resolve) => {
    auth.onAuthStateChanged((user) => {
      if (user) {
        router.navigate(['/']);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};
