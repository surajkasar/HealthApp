import { DecimalPipe, NgClass } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import {
  FoodEntry,
  MEAL_LABELS,
  MEAL_ORDER,
  MealType,
  StreakStats,
  entryToSnapshot,
} from '../../core/models/food.models';
import { AuthService } from '../../core/services/auth.service';
import { FoodService } from '../../core/services/food.service';
import { LibraryService } from '../../core/services/library.service';
import {
  formatDisplayDate,
  isToday,
  shiftDate,
  todayInAppTz,
} from '../../core/utils/date.util';
import { MiniChartComponent } from '../../shared/mini-chart.component';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [RouterLink, DecimalPipe, NgClass, MiniChartComponent, FormsModule],
  templateUrl: './today.component.html',
})
export class TodayComponent implements OnInit {
  private readonly food = inject(FoodService);
  private readonly library = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  readonly date = signal(todayInAppTz());
  readonly entries = signal<FoodEntry[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly macroDonut = signal<ChartConfiguration | null>(null);
  readonly streaks = signal<StreakStats | null>(null);
  readonly templateName = signal('');

  readonly displayDate = computed(() => formatDisplayDate(this.date()));
  readonly isTodayDate = computed(() => isToday(this.date()));
  readonly totals = computed(() => this.food.sumMacros(this.entries()));
  readonly profile = computed(() => this.auth.profile());

  readonly caloriePct = computed(() => {
    const t = this.profile()?.calorieTarget || 1;
    return Math.min(100, Math.round((this.totals().calories / t) * 100));
  });

  readonly remaining = computed(() => {
    const p = this.profile();
    const tot = this.totals();
    if (!p) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return {
      calories: Math.round(p.calorieTarget - tot.calories),
      protein: Math.round(p.proteinTarget - tot.protein),
      carbs: Math.round(p.carbsTarget - tot.carbs),
      fat: Math.round(p.fatTarget - tot.fat),
    };
  });

  readonly meals = computed(() => {
    const grouped: Record<MealType, FoodEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const e of this.entries()) {
      grouped[e.mealType].push(e);
    }
    return MEAL_ORDER.map((meal) => ({
      meal,
      label: MEAL_LABELS[meal],
      items: grouped[meal],
      subtotal: this.food.sumMacros(grouped[meal]),
    }));
  });

  constructor() {
    effect(() => {
      const tot = this.totals();
      const split = this.food.macroCalorieSplit(tot);
      const hasData = split.protein + split.carbs + split.fat > 0;
      if (!hasData) {
        this.macroDonut.set(null);
        return;
      }
      this.macroDonut.set({
        type: 'doughnut',
        data: {
          labels: ['Protein', 'Carbs', 'Fat'],
          datasets: [
            {
              data: [
                Math.round(split.protein),
                Math.round(split.carbs),
                Math.round(split.fat),
              ],
              backgroundColor: ['#22c55e', '#f97316', '#0ea5e9'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 10, color: '#c5d5cb' },
            },
          },
        },
      });
    });
  }

  async ngOnInit(): Promise<void> {
    const q = this.route.snapshot.queryParamMap.get('date');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) this.date.set(q);
    await this.reload();
  }

  async prevDay(): Promise<void> {
    this.date.set(shiftDate(this.date(), -1));
    await this.reload();
  }

  async nextDay(): Promise<void> {
    if (this.isTodayDate()) return;
    this.date.set(shiftDate(this.date(), 1));
    await this.reload();
  }

  async goToday(): Promise<void> {
    this.date.set(todayInAppTz());
    await this.reload();
  }

  async remove(id: string): Promise<void> {
    await this.food.deleteEntry(id);
    await this.reload();
  }

  async copyYesterday(): Promise<void> {
    const yesterday = shiftDate(this.date(), -1);
    this.busy.set(true);
    this.message.set(null);
    const err = await this.food.copyDay(yesterday, this.date());
    this.busy.set(false);
    if (err) {
      this.message.set(err);
      return;
    }
    this.message.set('Copied yesterday’s meals.');
    await this.reload();
  }

  async copyMealFromYesterday(meal: MealType): Promise<void> {
    const yesterday = shiftDate(this.date(), -1);
    this.busy.set(true);
    this.message.set(null);
    const err = await this.food.copyDay(yesterday, this.date(), meal);
    this.busy.set(false);
    if (err) {
      this.message.set(err);
      return;
    }
    this.message.set(`Copied yesterday’s ${MEAL_LABELS[meal]}.`);
    await this.reload();
  }

  async saveMealTemplate(meal: MealType): Promise<void> {
    const items = this.entries()
      .filter((e) => e.mealType === meal)
      .map(entryToSnapshot);
    if (!items.length) {
      this.message.set('Nothing to save for this meal.');
      return;
    }
    const name =
      this.templateName().trim() || `Usual ${MEAL_LABELS[meal]}`;
    this.busy.set(true);
    const err = await this.library.addTemplate({ name, mealType: meal, items });
    this.busy.set(false);
    this.message.set(err ? err : `Saved template “${name}”.`);
    this.templateName.set('');
  }

  pct(value: number, target: number): number {
    if (!target) return 0;
    return Math.min(100, Math.round((value / target) * 100));
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.entries.set(await this.food.getEntriesForDate(this.date()));
    const target = this.auth.profile()?.calorieTarget ?? 2000;
    this.streaks.set(await this.food.getStreakStats(target));
    this.loading.set(false);
  }
}
