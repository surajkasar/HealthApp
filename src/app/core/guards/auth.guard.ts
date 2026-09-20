import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait until auth bootstraps
  while (!auth.ready()) {
    await new Promise((r) => setTimeout(r, 20));
  }

  if (auth.user()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  while (!auth.ready()) {
    await new Promise((r) => setTimeout(r, 20));
  }

  if (!auth.user()) {
    return true;
  }
  return router.createUrlTree(['/']);
};
