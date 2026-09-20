import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = signal<'signin' | 'signup'>('signin');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  email = '';
  password = '';
  displayName = '';

  get configured(): boolean {
    return this.auth.configured;
  }

  async submit(): Promise<void> {
    this.error.set(null);
    if (!this.configured) {
      this.error.set(
        'Supabase is not configured. Add your project URL and anon key in environment.development.ts — see SUPABASE.md.'
      );
      return;
    }
    if (!this.email.trim() || !this.password.trim()) {
      this.error.set('Email and password are required.');
      return;
    }
    this.loading.set(true);
    try {
      const err =
        this.mode() === 'signin'
          ? await this.auth.signIn(this.email.trim(), this.password)
          : await this.auth.signUp(this.email.trim(), this.password, this.displayName.trim());
      if (err) {
        this.error.set(err);
        return;
      }
      await this.router.navigateByUrl('/');
    } catch (e) {
      console.error(e);
      this.error.set('Sign-in failed. Try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
