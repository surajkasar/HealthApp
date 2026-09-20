import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CameraDevice,
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import {
  FoodSearchResult,
  MEAL_LABELS,
  MEAL_ORDER,
  MealType,
} from '../../core/models/food.models';
import { FoodService } from '../../core/services/food.service';
import { OpenFoodFactsService } from '../../core/services/open-food-facts.service';
import { todayInAppTz } from '../../core/utils/date.util';

const DRINK_QUICK_ML = [200, 250, 330, 500];

const SCAN_CONFIG = {
  fps: 10,
  qrbox: { width: 280, height: 180 },
  aspectRatio: 1.777,
};

const FORMATS = {
  formatsToSupport: [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.QR_CODE,
  ],
  verbose: false,
};

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './scan.component.html',
})
export class ScanComponent implements AfterViewInit, OnDestroy {
  @ViewChild('reader', { static: true }) readerRef!: ElementRef<HTMLDivElement>;

  private readonly off = inject(OpenFoodFactsService);
  private readonly food = inject(FoodService);
  private readonly router = inject(Router);

  private scanner: Html5Qrcode | null = null;
  private handling = false;

  readonly scanning = signal(false);
  readonly starting = signal(false);
  readonly cameraError = signal<string | null>(null);
  readonly lookupError = signal<string | null>(null);
  readonly product = signal<FoodSearchResult | null>(null);
  readonly mealType = signal<MealType>('snack');
  readonly portion = signal(100);
  readonly saving = signal(false);
  readonly fileScanning = signal(false);

  /** True on http://LAN — live camera often blocked; photo/manual still work. */
  readonly insecureContext = signal(!globalThis.isSecureContext);

  codeInput = '';
  readonly mealOptions = MEAL_ORDER;
  readonly mealLabels = MEAL_LABELS;
  readonly drinkQuickMl = DRINK_QUICK_ML;
  readonly readerId = 'qr-reader';

  async ngAfterViewInit(): Promise<void> {
    await this.startScanner();
  }

  async ngOnDestroy(): Promise<void> {
    await this.stopScanner();
  }

  async startScanner(): Promise<void> {
    this.cameraError.set(null);
    this.starting.set(true);
    this.handling = false;

    try {
      await this.stopScanner();
      this.ensureReaderElement();
      this.scanner = new Html5Qrcode(this.readerId, FORMATS);

      const started = await this.tryStartCamera(this.scanner);
      if (!started) {
        this.cameraError.set(this.cameraUnavailableMessage());
        this.scanning.set(false);
        return;
      }
      this.scanning.set(true);
    } catch (err) {
      console.error(err);
      this.cameraError.set(this.cameraUnavailableMessage());
      this.scanning.set(false);
    } finally {
      this.starting.set(false);
    }
  }

  async stopScanner(): Promise<void> {
    if (this.scanner) {
      try {
        if (this.scanner.isScanning) {
          await this.scanner.stop();
        }
        this.scanner.clear();
      } catch {
        // ignore cleanup errors
      }
      this.scanner = null;
    }
    this.scanning.set(false);
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.lookupError.set(null);
    this.fileScanning.set(true);
    try {
      // scanFile cannot run while camera stream is active
      await this.stopScanner();
      this.ensureReaderElement();
      const fileScanner = new Html5Qrcode(this.readerId, FORMATS);
      const decoded = await fileScanner.scanFile(file, true);
      try {
        fileScanner.clear();
      } catch {
        // ignore
      }
      await this.onDetected(decoded);
    } catch (err) {
      console.error(err);
      this.lookupError.set(
        'Could not read a barcode from that image. Try a clearer photo or enter the code manually.'
      );
      // Try to restore live camera if possible
      void this.startScanner();
    } finally {
      this.fileScanning.set(false);
    }
  }

  async lookupManual(): Promise<void> {
    await this.onDetected(this.codeInput.trim());
  }

  setPortion(qty: number): void {
    this.portion.set(qty);
  }

  basisLabel(item: FoodSearchResult): string {
    return item.nutritionBasis === 'ml' ? '100ml' : '100g';
  }

  portionLabel(item: FoodSearchResult): string {
    return item.nutritionBasis === 'ml' ? 'Portion (ml)' : 'Portion (grams)';
  }

  scaled() {
    const item = this.product();
    if (!item) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 };
    }
    return this.off.scaleToPortion(item, this.portion());
  }

  async save(): Promise<void> {
    const item = this.product();
    if (!item) return;
    const macros = this.scaled();
    this.saving.set(true);
    const err = await this.food.addEntry({
      loggedDate: todayInAppTz(),
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
      servingUnit: item.servingUnit,
      barcode: item.barcode,
      source: 'barcode',
    });
    this.saving.set(false);
    if (err) {
      this.lookupError.set(err);
      return;
    }
    await this.router.navigateByUrl('/');
  }

  clearProduct(): void {
    this.product.set(null);
    this.lookupError.set(null);
    this.handling = false;
  }

  async scanAgain(): Promise<void> {
    this.clearProduct();
    await this.startScanner();
  }

  private async tryStartCamera(scanner: Html5Qrcode): Promise<boolean> {
    const onSuccess = (decoded: string) => void this.onDetected(decoded);
    const onError = () => undefined;

    // 1) Rear camera (phones)
    if (await this.tryStart(scanner, { facingMode: 'environment' }, onSuccess, onError)) {
      return true;
    }

    // 2) Front camera (laptops)
    if (await this.tryStart(scanner, { facingMode: 'user' }, onSuccess, onError)) {
      return true;
    }

    // 3) Any enumerated device
    let cameras: CameraDevice[] = [];
    try {
      cameras = await Html5Qrcode.getCameras();
    } catch (err) {
      console.error('getCameras failed', err);
      return false;
    }

    for (const cam of cameras) {
      if (await this.tryStart(scanner, cam.id, onSuccess, onError)) {
        return true;
      }
    }

    return false;
  }

  private async tryStart(
    scanner: Html5Qrcode,
    cameraIdOrConfig: string | MediaTrackConstraints,
    onSuccess: (decoded: string) => void,
    onError: () => void
  ): Promise<boolean> {
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // ignore
    }

    try {
      await scanner.start(cameraIdOrConfig, SCAN_CONFIG, onSuccess, onError);
      return true;
    } catch (err) {
      console.warn('Camera start failed for config', cameraIdOrConfig, err);
      return false;
    }
  }

  private ensureReaderElement(): void {
    const el = this.readerRef.nativeElement;
    el.id = this.readerId;
    el.innerHTML = '';
  }

  private cameraUnavailableMessage(): string {
    if (this.insecureContext()) {
      return (
        'Live camera needs HTTPS or localhost. On a phone over Wi‑Fi HTTP, ' +
        'use “Upload barcode photo” or type the code below. ' +
        'On a laptop, allow camera permission and retry.'
      );
    }
    return (
      'Camera unavailable. Allow camera access in the browser / system settings, ' +
      'close other apps using the camera, then tap Retry — or upload a photo / type the code.'
    );
  }

  private async onDetected(code: string): Promise<void> {
    if (!code || this.handling) return;
    this.handling = true;
    this.lookupError.set(null);
    try {
      const found = await this.off.getByBarcode(code);
      if (!found) {
        this.lookupError.set(
          `No product found for code ${code}. Try search or manual entry.`
        );
        this.handling = false;
        return;
      }
      this.product.set(found);
      this.portion.set(
        found.servingSize > 0
          ? found.servingSize
          : found.nutritionBasis === 'ml'
            ? 250
            : 100
      );
      await this.stopScanner();
    } catch (err) {
      this.lookupError.set(err instanceof Error ? err.message : 'Lookup failed');
      this.handling = false;
    }
  }
}
