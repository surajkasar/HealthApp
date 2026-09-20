import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  from,
  of,
  switchMap,
} from 'rxjs';
import {
  CustomFood,
  FavoriteFood,
  FoodSearchResult,
  FoodSnapshot,
  MEAL_LABELS,
  MEAL_ORDER,
  MealTemplate,
  MealType,
} from '../../core/models/food.models';
import { FoodSearchService } from '../../core/services/food-search.service';
import { FoodService } from '../../core/services/food.service';
import { LibraryService } from '../../core/services/library.service';
import { OpenFoodFactsService } from '../../core/services/open-food-facts.service';
import { todayInAppTz } from '../../core/utils/date.util';

type Tab = 'search' | 'recents' | 'library' | 'quick' | 'custom';

@Component({
  selector: 'app-add-food',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './add-food.component.html',
})
export class AddFoodComponent implements OnInit {
  private readonly searchApi = inject(FoodSearchService);
  private readonly off = inject(OpenFoodFactsService);
  private readonly food = inject(FoodService);
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly tab = signal<Tab>('search');
  readonly mealType = signal<MealType>('snack');
  readonly query = signal('');
  readonly results = signal<FoodSearchResult[]>([]);
  readonly searching = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly selected = signal<FoodSearchResult | null>(null);
  readonly portion = signal(100);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveOk = signal<string | null>(null);
  readonly loggedDate = signal(todayInAppTz());

  readonly recents = signal<FoodSnapshot[]>([]);
  readonly favorites = signal<FavoriteFood[]>([]);
  readonly customs = signal<CustomFood[]>([]);
  readonly templates = signal<MealTemplate[]>([]);
  readonly indian = signal<FoodSearchResult[]>([]);

  readonly mealOptions = MEAL_ORDER;
  readonly mealLabels = MEAL_LABELS;
  readonly drinkQuickMl = [200, 250, 330, 500];

  // Manual / custom / quick forms
  manualName = '';
  manualBrand = '';
  manualCalories = 0;
  manualProtein = 0;
  manualCarbs = 0;
  manualFat = 0;
  manualFiber = 0;
  manualSodium = 0;
  manualSugar = 0;
  manualQty = 1;
  manualUnit = 'serving';

  quickName = '';
  quickCalories = 0;

  customName = '';
  customBrand = '';
  customCalories = 0;
  customProtein = 0;
  customCarbs = 0;
  customFat = 0;
  customFiber = 0;
  customSodium = 0;
  customSugar = 0;
  customQty = 1;
  customUnit = 'serving';

  templateName = '';

  private readonly search$ = new Subject<string>();

  async ngOnInit(): Promise<void> {
    const meal = this.route.snapshot.queryParamMap.get('meal') as MealType | null;
    if (meal && MEAL_ORDER.includes(meal)) this.mealType.set(meal);
    const date = this.route.snapshot.queryParamMap.get('date');
    if (date) this.loggedDate.set(date);

    this.indian.set(this.searchApi.listIndianPresets('').slice(0, 12));
    await this.reloadLibrary();

    this.search$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.searching.set(false);
            this.results.set(this.searchApi.listIndianPresets(q).slice(0, 20));
            return of([] as FoodSearchResult[]);
          }
          this.searching.set(true);
          this.searchError.set(null);
          return from(this.searchApi.search(q)).pipe(
            catchError((err: Error) => {
              this.searchError.set(err.message || 'Search failed');
              return of([] as FoodSearchResult[]);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((items) => {
        if (this.query().trim().length >= 2) {
          this.results.set(items);
        }
        this.searching.set(false);
      });
  }

  async setTab(tab: Tab): Promise<void> {
    this.tab.set(tab);
    this.saveError.set(null);
    this.saveOk.set(null);
    this.selected.set(null);
    if (tab === 'recents' || tab === 'library') {
      await this.reloadLibrary();
    }
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.selected.set(null);
    this.search$.next(value);
  }

  pick(item: FoodSearchResult): void {
    this.selected.set(item);
    this.portion.set(
      item.servingSize > 0 ? item.servingSize : item.nutritionBasis === 'ml' ? 250 : 100
    );
  }

  setPortion(qty: number): void {
    this.portion.set(qty);
  }

  basisLabel(item: FoodSearchResult): string {
    if (item.provider === 'indian') return 'serving';
    return item.nutritionBasis === 'ml' ? '100ml' : '100g';
  }

  portionLabel(item: FoodSearchResult): string {
    if (item.provider === 'indian') return `Portion (% of serving)`;
    return item.nutritionBasis === 'ml' ? 'Portion (ml)' : 'Portion (grams)';
  }

  scaled() {
    const item = this.selected();
    if (!item) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 };
    }
    return this.off.scaleToPortion(item, this.portion());
  }

  providerBadge(item: FoodSearchResult): string {
    switch (item.provider) {
      case 'usda':
        return 'USDA';
      case 'indian':
        return 'Indian';
      case 'openfoodfacts':
        return 'OFF';
      default:
        return '';
    }
  }

  async saveSelected(): Promise<void> {
    const item = this.selected();
    if (!item) return;
    const macros = this.scaled();
    const source =
      item.provider === 'usda'
        ? 'usda'
        : item.provider === 'indian'
          ? 'indian'
          : item.barcode
            ? 'barcode'
            : 'openfoodfacts';
    await this.persist({
      loggedDate: this.loggedDate(),
      mealType: this.mealType(),
      name: item.name,
      brand: item.brand,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: macros.fiber,
      sodium: macros.sodium,
      sugar: macros.sugar,
      servingQty: this.portion(),
      servingUnit:
        item.provider === 'indian'
          ? String(item.servingUnit)
          : item.nutritionBasis === 'ml'
            ? 'ml'
            : 'g',
      barcode: item.barcode,
      source,
    });
  }

  async addSnapshot(snap: FoodSnapshot, source: 'favorite' | 'custom' | 'manual' = 'manual'): Promise<void> {
    await this.persist({
      loggedDate: this.loggedDate(),
      mealType: this.mealType(),
      ...snap,
      source: source === 'manual' ? snap.source : source,
    });
  }

  async addCustomAsEntry(c: CustomFood): Promise<void> {
    await this.addSnapshot(
      {
        name: c.name,
        brand: c.brand,
        calories: c.calories,
        protein: c.protein,
        carbs: c.carbs,
        fat: c.fat,
        fiber: c.fiber,
        sodium: c.sodium,
        sugar: c.sugar,
        servingQty: c.servingQty,
        servingUnit: c.servingUnit,
        source: 'custom',
      },
      'custom'
    );
  }

  async applyTemplate(t: MealTemplate): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    const err = await this.food.applySnapshots(
      this.loggedDate(),
      t.mealType,
      t.items,
      'template'
    );
    this.saving.set(false);
    if (err) {
      this.saveError.set(err);
      return;
    }
    await this.router.navigateByUrl('/');
  }

  async toggleFavoriteFromSelected(): Promise<void> {
    const item = this.selected();
    if (!item) return;
    const macros = this.scaled();
    const snap: FoodSnapshot = {
      name: item.name,
      brand: item.brand,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: macros.fiber,
      sodium: macros.sodium,
      sugar: macros.sugar,
      servingQty: this.portion(),
      servingUnit:
        item.provider === 'indian'
          ? String(item.servingUnit)
          : item.nutritionBasis === 'ml'
            ? 'ml'
            : 'g',
      barcode: item.barcode,
      source: 'favorite',
    };
    const err = await this.library.addFavorite(snap);
    this.saveOk.set(err ? err : 'Added to favorites');
    await this.reloadLibrary();
  }

  async favoriteSnapshot(snap: FoodSnapshot): Promise<void> {
    const err = await this.library.addFavorite({ ...snap, source: 'favorite' });
    this.saveOk.set(err ? err : 'Added to favorites');
    await this.reloadLibrary();
  }

  async removeFavorite(id: string): Promise<void> {
    await this.library.deleteFavorite(id);
    await this.reloadLibrary();
  }

  async saveQuick(): Promise<void> {
    if (!this.quickName.trim()) {
      this.saveError.set('Name is required');
      return;
    }
    await this.persist({
      loggedDate: this.loggedDate(),
      mealType: this.mealType(),
      name: this.quickName.trim(),
      calories: Number(this.quickCalories) || 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sodium: 0,
      sugar: 0,
      servingQty: 1,
      servingUnit: 'serving',
      source: 'quick',
    });
  }

  async saveCustomFood(): Promise<void> {
    if (!this.customName.trim()) {
      this.saveError.set('Name is required');
      return;
    }
    this.saving.set(true);
    const err = await this.library.addCustomFood({
      name: this.customName.trim(),
      brand: this.customBrand.trim() || null,
      calories: Number(this.customCalories) || 0,
      protein: Number(this.customProtein) || 0,
      carbs: Number(this.customCarbs) || 0,
      fat: Number(this.customFat) || 0,
      fiber: Number(this.customFiber) || 0,
      sodium: Number(this.customSodium) || 0,
      sugar: Number(this.customSugar) || 0,
      servingQty: Number(this.customQty) || 1,
      servingUnit: this.customUnit || 'serving',
    });
    this.saving.set(false);
    if (err) {
      this.saveError.set(err);
      return;
    }
    this.saveOk.set('Custom food saved — tap it under Library to log.');
    this.customName = '';
    await this.reloadLibrary();
    this.tab.set('library');
  }

  async deleteCustom(id: string): Promise<void> {
    await this.library.deleteCustomFood(id);
    await this.reloadLibrary();
  }

  async saveManual(): Promise<void> {
    if (!this.manualName.trim()) {
      this.saveError.set('Food name is required.');
      return;
    }
    await this.persist({
      loggedDate: this.loggedDate(),
      mealType: this.mealType(),
      name: this.manualName.trim(),
      brand: this.manualBrand.trim() || null,
      calories: Number(this.manualCalories) || 0,
      protein: Number(this.manualProtein) || 0,
      carbs: Number(this.manualCarbs) || 0,
      fat: Number(this.manualFat) || 0,
      fiber: Number(this.manualFiber) || 0,
      sodium: Number(this.manualSodium) || 0,
      sugar: Number(this.manualSugar) || 0,
      servingQty: Number(this.manualQty) || 1,
      servingUnit: this.manualUnit || 'serving',
      source: 'manual',
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.library.deleteTemplate(id);
    await this.reloadLibrary();
  }

  private async persist(
    input: Parameters<FoodService['addEntry']>[0]
  ): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    const err = await this.food.addEntry(input);
    this.saving.set(false);
    if (err) {
      this.saveError.set(err);
      return;
    }
    await this.router.navigateByUrl('/');
  }

  private async reloadLibrary(): Promise<void> {
    const [recents, favorites, customs, templates] = await Promise.all([
      this.food.getRecentFoods(7, 24),
      this.library.listFavorites(),
      this.library.listCustomFoods(),
      this.library.listTemplates(),
    ]);
    this.recents.set(recents);
    this.favorites.set(favorites);
    this.customs.set(customs);
    this.templates.set(templates);
  }
}
