import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FoodService } from '../../core/services/food.service';
import { formatDisplayDate, todayInAppTz } from '../../core/utils/date.util';

interface HistoryRow {
  date: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './history.component.html',
})
export class HistoryComponent implements OnInit {
  private readonly food = inject(FoodService);

  readonly rows = signal<HistoryRow[]>([]);
  readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const dates = await this.food.getRecentDates(21);
    const today = todayInAppTz();
    const unique = dates.includes(today) ? dates : [today, ...dates];
    const rows: HistoryRow[] = [];
    for (const date of unique.slice(0, 21)) {
      const entries = await this.food.getEntriesForDate(date);
      const totals = this.food.sumMacros(entries);
      rows.push({
        date,
        label: date === today ? `Today · ${formatDisplayDate(date)}` : formatDisplayDate(date),
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
      });
    }
    this.rows.set(rows);
    this.loading.set(false);
  }
}
