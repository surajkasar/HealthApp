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

/** Adaptive scan box — fixed 280×180 overflows many phone viewfinders and breaks start(). */
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
  @ViewChild('reader', { static: true }) readerRef!: ElementRef<HTMLDivElement>;

  private readonly off = inject(OpenFoodFactsService);
  private readonly food = inject(FoodService);
  private readonly router = inject(Router);

  private scanner: Html5Qrcode | null = null;
  private handling = false;
  private lastCameraError = '';

  readonly scanning = signal(false);
  readonly starting = signal(false);
  readonly needsTap = signal(false);
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
    // Try auto-start (works on many desktops). Mobile often needs a tap — see needsTap.
    await this.startScanner({ fromUserGesture: false });
  }

  async ngOnDestroy(): Promise<void> {
    await this.stopScanner();
  }

  /** Black-box / Retry — always a user gesture so getUserMedia is allowed. */
  async onEnableCamera(): Promise<void> {
    await this.startScanner({ fromUserGesture: true });
  }

  async startScanner(opts: { fromUserGesture: boolean } = { fromUserGesture: true }): Promise<void> {
    this.cameraError.set(null);
    this.lastCameraError = '';
    this.starting.set(true);
    this.needsTap.set(false);
    this.handling = false;

    try {
      if (this.insecureContext()) {
        this.cameraError.set(this.cameraUnavailableMessage());
        this.scanning.set(false);
        this.needsTap.set(false);
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        this.cameraError.set(
          'This browser does not support camera access. Use photo upload or type the code.'
        );
        return;
      }

      await this.stopScanner();
      this.ensureReaderElement();

      // Explicit permission first — more reliable than html5-qrcode alone on iOS/Chrome.
      const permitted = await this.requestCameraPermission();
      if (!permitted) {
        if (!opts.fromUserGesture) {
          // Auto-start blocked until user taps the preview.
          this.needsTap.set(true);
          this.scanning.set(false);
          return;
        }
        this.cameraError.set(this.cameraUnavailableMessage());
        this.needsTap.set(true);
        this.scanning.set(false);
        return;
      }

      this.scanner = new Html5Qrcode(this.readerId, FORMATS);
      const started = await this.tryStartCamera(this.scanner);
      if (!started) {
        if (!opts.fromUserGesture) {
          this.needsTap.set(true);
        } else {
          this.cameraError.set(this.cameraUnavailableMessage());
          this.needsTap.set(true);
        }
        this.scanning.set(false);
        return;
      }
      this.scanning.set(true);
      this.needsTap.set(false);
    } catch (err) {
      console.error(err);
      this.lastCameraError = err instanceof Error ? err.message : String(err);
      if (!opts.fromUserGesture) {
        this.needsTap.set(true);
      } else {
        this.cameraError.set(this.cameraUnavailableMessage());
        this.needsTap.set(true);
      }
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
      void this.startScanner({ fromUserGesture: false });
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
    await this.startScanner({ fromUserGesture: true });
  }

  /** Unlock permission with a real getUserMedia call, then release tracks. */
  private async requestCameraPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err) {
      console.warn('getUserMedia environment failed', err);
      this.lastCameraError = err instanceof Error ? err.message : String(err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
        stream.getTracks().forEach((t) => t.stop());
        return true;
      } catch (err2) {
        console.warn('getUserMedia any video failed', err2);
        this.lastCameraError = err2 instanceof Error ? err2.message : String(err2);
        return false;
      }
    }
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

    const ordered = this.preferRearCameras(cameras);
    for (const cam of ordered) {
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
    const rear = cameras.filter((c) =>
      /back|rear|environment|world/i.test(c.label)
    );
    const front = cameras.filter((c) => /front|user|face/i.test(c.label));
    const rest = cameras.filter((c) => !rear.includes(c) && !front.includes(c));
    // Phones: rear first. Laptops often only have "front"/ unlabeled — use all.
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

  private ensureReaderElement(): void {
    const el = this.readerRef.nativeElement;
    el.id = this.readerId;
    el.innerHTML = '';
  }

  private cameraUnavailableMessage(): string {
    if (this.insecureContext()) {
      return (
        'Live camera needs HTTPS or localhost. Use “Upload barcode photo” or type the code.'
      );
    }
    const detail = this.lastCameraError ? ` (${this.lastCameraError})` : '';
    return (
      `Camera unavailable${detail}. Allow camera for this site in browser/system settings, ` +
      'close other apps using the camera, then tap the preview — or upload a photo / type the code.'
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
