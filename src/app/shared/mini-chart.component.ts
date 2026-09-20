import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-mini-chart',
  standalone: true,
  template: `<div class="relative w-full" [style.height.px]="height">
    <canvas #canvas></canvas>
  </div>`,
})
export class MiniChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) config!: ChartConfiguration;
  @Input() height = 220;

  private chart: Chart | null = null;
  private ready = false;

  ngAfterViewInit(): void {
    this.ready = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && this.ready) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private render(): void {
    if (!this.config || !this.canvasRef) return;
    this.chart?.destroy();
    this.chart = new Chart(this.canvasRef.nativeElement, this.config);
  }
}
