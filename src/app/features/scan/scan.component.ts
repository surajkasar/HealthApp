import { DecimalPipe } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, inject, signal } from '@angular/core';
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
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const width = Math.max(160, Math.min(280, Math.floor(viewfinderWidth * 0.85)));
    const height = Math.max(100, Math.min(180, Math.floor(viewfinderHeight * 0.45)));
    return { width, height };
  },
  aspectRatio: 1.333,
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
  private readonly off = inject(OpenFoodFactsService);
  private readonly food = inject(FoodService);
  private readonly router = inject(Router);

  private scanner: Html5Qrcode | null = null;
  private handling = false;
  private lastCameraError = '';

  readonly scanning = signal(false);
  readonly starting = signal(false);
  /** Always show tap-to-start until camera is live (mobile needs a real gesture). */
  readonly needsTap = signal(true);
  readonly cameraError = signal<string | null>(null);
  readonly lookupError = signal<string | null>(null);
  readonly product = signal<FoodSearchResult | null>(null);
  readonly mealType = signal<MealType>('snack');
  readonly portion = signal(100);
  readonly saving = signal(false);
  readonly fileScanning = signal(false);

  readonly insecureContext = signal(!globalThis.isSecureContext);

  codeInput = '';
  readonly mealOptions = MEAL_ORDER;
  readonly mealLabels = MEAL_LABELS;
  readonly drinkQuickMl = DRINK_QUICK_ML;
  readonly readerId = 'qr-reader';

  ngAfterViewInit(): void {
    // Do NOT call getUserMedia here — browsers suppress the permission prompt
    // unless it runs in a user gesture (tap). Show tap-to-start instead.
    if (this.insecureContext()) {
      this.cameraError.set(this.cameraUnavailableMessage());
      this.needsTap.set(false);
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.stopScanner();
  }

  /**
   * Must call getUserMedia as the first await in this click handler.
   * Any prior await (stopScanner, etc.) breaks the gesture on iOS/Android Chrome
   * and the permission dialog never appears.
   */
  async onEnableCamera(): Promise<void> {
    this.cameraError.set(null);
    this.lastCameraError = '';
    this.starting.set(true);
    this.needsTap.set(false);
    this.handling = false;

    if (this.insecureContext()) {
      this.starting.set(false);
      this.cameraError.set(this.cameraUnavailableMessage());
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.starting.set(false);
      this.cameraError.set(
        'This browser does not support camera access. Use photo upload or type the code.'
      );
      this.needsTap.set(true);
      return;
    }

    // --- FIRST await: permission prompt (keep gesture alive) ---
    let warmup: MediaStream | null = null;
    try {
      warmup = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
    } catch (err1) {
      this.lastCameraError = err1 instanceof Error ? err1.message : String(err1);
      try {
        warmup = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      } catch (err2) {
        this.lastCameraError = err2 instanceof Error ? err2.message : String(err2);
        this.starting.set(false);
        this.needsTap.set(true);
        this.cameraError.set(this.permissionDeniedMessage(err2));
        return;
      }
    }

    // Release warmup tracks so html5-qrcode can open the camera.
    warmup.getTracks().forEach((t) => t.stop());
    warmup = null;

    try {
      await this.stopScanner();
      this.ensureReaderElement();
      this.scanner = new Html5Qrcode(this.readerId, FORMATS);
      const started = await this.tryStartCamera(this.scanner);
      if (!started) {
        this.cameraError.set(this.cameraUnavailableMessage());
        this.needsTap.set(true);
        this.scanning.set(false);
        return;
      }
      this.scanning.set(true);
      this.needsTap.set(false);
    } catch (err) {
      console.error(err);
      this.lastCameraError = err instanceof Error ? err.message : String(err);
      this.cameraError.set(this.cameraUnavailableMessage());
      this.needsTap.set(true);
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
      this.needsTap.set(true);
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
    this.needsTap.set(true);
    // User already tapped "Scan again" — start immediately under that gesture.
    await this.onEnableCamera();
  }

  private async tryStartCamera(scanner: Html5Qrcode): Promise<boolean> {
    const onSuccess = (decoded: string) => void this.onDetected(decoded);
    const onError = () => undefined;

    let cameras: CameraDevice[] = [];
    try {
      cameras = await Html5Qrcode.getCameras();
    } catch (err) {
      console.error('getCameras failed', err);
      this.lastCameraError = err instanceof Error ? err.message : String(err);
    }

    for (const cam of this.preferRearCameras(cameras)) {
      if (await this.tryStart(scanner, cam.id, onSuccess, onError)) {
        return true;
      }
    }

    if (await this.tryStart(scanner, { facingMode: 'environment' }, onSuccess, onError)) {
      return true;
    }
    if (await this.tryStart(scanner, { facingMode: 'user' }, onSuccess, onError)) {
      return true;
    }

    return false;
  }

  private preferRearCameras(cameras: CameraDevice[]): CameraDevice[] {
    if (!cameras.length) return [];
    const rear = cameras.filter((c) => /back|rear|environment|world/i.test(c.label));
    const front = cameras.filter((c) => /front|user|face/i.test(c.label));
    const rest = cameras.filter((c) => !rear.includes(c) && !front.includes(c));
    return [...rear, ...rest, ...front];
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
      this.lastCameraError = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  /**
   * Resolve the scanner host by id — do not use static ViewChild.
   * `#reader` lives inside `@if (!product())`, so `@ViewChild(..., { static: true })`
   * is undefined on Safari/iOS and crashes after permission is granted.
   */
  private ensureReaderElement(): HTMLElement {
    const el = document.getElementById(this.readerId);
    if (!el) {
      throw new Error('Scanner area not ready. Tap Start camera again.');
    }
    el.innerHTML = '';
    return el;
  }

  private permissionDeniedMessage(err: unknown): string {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
    const msg = err instanceof Error ? err.message : String(err);
    if (name === 'NotAllowedError' || /denied|permission/i.test(msg)) {
      return (
        'Camera permission is blocked for this site. On iPhone: Settings → Safari → Camera ' +
        '(or the aA menu → Website Settings). On Android Chrome: lock icon → Permissions → Camera → Allow. ' +
        'Then tap Start camera again.'
      );
    }
    if (name === 'NotFoundError') {
      return 'No camera found on this device. Use photo upload or type the code.';
    }
    return this.cameraUnavailableMessage();
  }

  private cameraUnavailableMessage(): string {
    if (this.insecureContext()) {
      return (
        'Live camera needs HTTPS or localhost. Use “Upload barcode photo” or type the code.'
      );
    }
    const detail = this.lastCameraError ? ` (${this.lastCameraError})` : '';
    return (
      `Camera unavailable${detail}. Tap “Start camera”, allow access when asked, ` +
      'or use photo upload / type the code.'
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
