import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-targets',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './targets.component.html',
})
export class TargetsComponent implements OnInit {
  private readonly auth = inject(AuthService);

  calorieTarget = 2000;
  proteinTarget = 150;
  carbsTarget = 200;
  fatTarget = 65;

  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const p = this.auth.profile();
    if (p) {
      this.calorieTarget = p.calorieTarget;
      this.proteinTarget = p.proteinTarget;
      this.carbsTarget = p.carbsTarget;
      this.fatTarget = p.fatTarget;
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.message.set(null);
    this.error.set(null);
    const err = await this.auth.updateTargets({
      calorieTarget: Number(this.calorieTarget) || 0,
      proteinTarget: Number(this.proteinTarget) || 0,
      carbsTarget: Number(this.carbsTarget) || 0,
      fatTarget: Number(this.fatTarget) || 0,
    });
    this.saving.set(false);
    if (err) {
      this.error.set(err);
      return;
    }
    this.message.set('Goals updated.');
  }
}
