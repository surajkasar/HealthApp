import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration } from 'chart.js';
import {
  DayNutritionSummary,
  MEAL_LABELS,
  MEAL_ORDER,
  WeightEntry,
} from '../../core/models/food.models';
import { AuthService } from '../../core/services/auth.service';
import { FoodService } from '../../core/services/food.service';
import { WeightService } from '../../core/services/weight.service';
import {
  dateRangeEnding,
  formatDisplayDate,
  formatShortDate,
  todayInAppTz,
} from '../../core/utils/date.util';
import { MiniChartComponent } from '../../shared/mini-chart.component';

type Tab = 'nutrition' | 'weight';
type RangeDays = 7 | 14 | 30;

const COLORS = {
  protein: '#22c55e',
  carbs: '#f97316',
  fat: '#0ea5e9',
  calories: '#25332c',
  target: '#9bb5a5',
  breakfast: '#16a34a',
  lunch: '#ea580c',
  dinner: '#0284c7',
  snack: '#a16207',
  weight: '#15803d',
};

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [FormsModule, DecimalPipe, MiniChartComponent],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  private readonly food = inject(FoodService);
  private readonly weights = inject(WeightService);
  private readonly auth = inject(AuthService);

  readonly tab = signal<Tab>('nutrition');
  readonly rangeDays = signal<RangeDays>(7);
  readonly loading = signal(true);
  readonly summaries = signal<DayNutritionSummary[]>([]);
  readonly weightEntries = signal<WeightEntry[]>([]);

  readonly calorieChart = signal<ChartConfiguration | null>(null);
  readonly macroChart = signal<ChartConfiguration | null>(null);
  readonly mealChart = signal<ChartConfiguration | null>(null);
  readonly weightChart = signal<ChartConfiguration | null>(null);

  readonly avgCalories = signal(0);
  readonly daysOnTarget = signal(0);
  readonly latestWeight = signal<WeightEntry | null>(null);
  readonly weightDelta = signal<number | null>(null);

  weightKg: number | null = null;
  weightDate = todayInAppTz();
  weightNote = '';
  readonly savingWeight = signal(false);
  readonly weightError = signal<string | null>(null);
  readonly weightMessage = signal<string | null>(null);

  readonly rangeOptions: RangeDays[] = [7, 14, 30];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async setRange(days: RangeDays): Promise<void> {
    this.rangeDays.set(days);
    await this.reloadNutrition();
  }

  async setTab(tab: Tab): Promise<void> {
    this.tab.set(tab);
    if (tab === 'weight' && this.weightEntries().length === 0) {
      await this.reloadWeights();
    }
  }

  async saveWeight(): Promise<void> {
    this.weightError.set(null);
    this.weightMessage.set(null);
    const kg = Number(this.weightKg);
    this.savingWeight.set(true);
    const err = await this.weights.add({
      loggedDate: this.weightDate || todayInAppTz(),
      weightKg: kg,
      note: this.weightNote.trim() || null,
    });
    this.savingWeight.set(false);
    if (err) {
      this.weightError.set(err);
      return;
    }
    this.weightKg = null;
    this.weightNote = '';
    this.weightDate = todayInAppTz();
    this.weightMessage.set('Weight saved.');
    await this.reloadWeights();
  }

  async removeWeight(id: string): Promise<void> {
    await this.weights.delete(id);
    await this.reloadWeights();
  }

  formatDay(date: string): string {
    return formatDisplayDate(date);
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    await Promise.all([this.reloadNutrition(), this.reloadWeights()]);
    this.loading.set(false);
  }

  private async reloadNutrition(): Promise<void> {
    const dates = dateRangeEnding(todayInAppTz(), this.rangeDays());
    const summaries = await this.food.getDailySummaries(dates);
    this.summaries.set(summaries);

    const logged = summaries.filter((s) => s.calories > 0);
    const avg =
      logged.length === 0
        ? 0
        : Math.round(logged.reduce((a, s) => a + s.calories, 0) / logged.length);
    this.avgCalories.set(avg);

    const target = this.auth.profile()?.calorieTarget ?? 2000;
    this.daysOnTarget.set(
      summaries.filter((s) => s.calories > 0 && s.calories <= target + 50).length
    );

    this.calorieChart.set(this.buildCalorieChart(summaries, target));
    this.macroChart.set(this.buildMacroChart(summaries));
    this.mealChart.set(this.buildMealChart(summaries));
  }

  private async reloadWeights(): Promise<void> {
    const list = await this.weights.list(60);
    this.weightEntries.set(list);
    this.latestWeight.set(list[0] ?? null);

    if (list.length >= 2) {
      const newest = list[0].weightKg;
      const oldestInView = list[list.length - 1].weightKg;
      this.weightDelta.set(Math.round((newest - oldestInView) * 10) / 10);
    } else {
      this.weightDelta.set(null);
    }

    this.weightChart.set(this.buildWeightChart(list));
  }

  private buildCalorieChart(
    summaries: DayNutritionSummary[],
    target: number
  ): ChartConfiguration {
    return {
      type: 'bar',
      data: {
        labels: summaries.map((s) => formatShortDate(s.date)),
        datasets: [
          {
            label: 'Calories',
            data: summaries.map((s) => Math.round(s.calories)),
            backgroundColor: COLORS.calories,
            borderRadius: 6,
            maxBarThickness: 18,
          },
          {
            label: 'Target',
            data: summaries.map(() => target),
            type: 'line',
            borderColor: COLORS.target,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 10 } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    } as ChartConfiguration;
  }

  private buildMacroChart(summaries: DayNutritionSummary[]): ChartConfiguration {
    const totals = summaries.reduce(
      (acc, s) => ({
        protein: acc.protein + s.protein,
        carbs: acc.carbs + s.carbs,
        fat: acc.fat + s.fat,
      }),
      { protein: 0, carbs: 0, fat: 0 }
    );
    const split = this.food.macroCalorieSplit(totals);
    return {
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
            backgroundColor: [COLORS.protein, COLORS.carbs, COLORS.fat],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed} kcal`,
            },
          },
        },
      },
    };
  }

  private buildMealChart(summaries: DayNutritionSummary[]): ChartConfiguration {
    const mealTotals = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    for (const s of summaries) {
      for (const m of MEAL_ORDER) {
        mealTotals[m] += s.mealCalories[m];
      }
    }
    return {
      type: 'pie',
      data: {
        labels: MEAL_ORDER.map((m) => MEAL_LABELS[m]),
        datasets: [
          {
            data: MEAL_ORDER.map((m) => Math.round(mealTotals[m])),
            backgroundColor: [
              COLORS.breakfast,
              COLORS.lunch,
              COLORS.dinner,
              COLORS.snack,
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10 } },
        },
      },
    };
  }

  private buildWeightChart(entries: WeightEntry[]): ChartConfiguration {
    const chronological = [...entries].reverse();
    return {
      type: 'line',
      data: {
        labels: chronological.map((e) => formatShortDate(e.loggedDate)),
        datasets: [
          {
            label: 'Weight (kg)',
            data: chronological.map((e) => e.weightKg),
            borderColor: COLORS.weight,
            backgroundColor: 'rgba(21, 128, 61, 0.15)',
            fill: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: (v) => `${v} kg` } },
        },
      },
    };
  }
}
