import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from './api';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss'],
})
export class RegistrationComponent implements OnInit {
  private readonly TOTAL_TICKET_LIMIT = 123;

  api = inject(Api);
  fb = inject(FormBuilder);
  lots: any[] = [];
  event: any;
  selected: any;
  proof?: File;
  sending = false;
  error = '';
  success: any;
  pixCopied = false;
  showValidationErrors = false;
  soldOut = false;
  form = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    graduatedFromSchool: ['', Validators.required],
  });
  getLotCapacity(lot: any) {
    return lot?.quantityLimit ?? 0;
  }
  getRemainingSpots(lot: any) {
    return Math.max(0, this.getLotCapacity(lot) - (lot?.quantitySold ?? 0));
  }
  ngOnInit() {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    this.api.lots().subscribe((x) => {
      this.lots = x;
      const totalSold = x.reduce((sum, lot) => sum + (lot.quantitySold || 0), 0);
      this.soldOut = totalSold >= this.TOTAL_TICKET_LIMIT;
      this.selected = x.find((lot) => lot.isCurrent) ?? x[0] ?? null;
    });
    this.api.event().subscribe((x) => (this.event = x));
  }

  constructor() {
    // intentionally empty: initialization is handled in ngOnInit
  }
  select(lot: any) {
    this.selected = lot;
    this.error = '';
  }
  file(event: Event) {
    this.proof = (event.target as HTMLInputElement).files?.[0];
  }
  maskPhone() {
    let value = this.form.value.phone!.replace(/\D/g, '').slice(0, 11);
    if (value.length > 6) value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    else if (value.length > 2) value = value.replace(/(\d{2})(.*)/, '($1) $2');
    this.form.patchValue({ phone: value }, { emitEvent: false });
  }
  copy(value?: string) {
    if (value) navigator.clipboard.writeText(value);
    this.pixCopied = true;
  }
  isFieldInvalid(controlName: string) {
    return this.showValidationErrors && this.form.get(controlName)?.invalid;
  }
  isFileInvalid() {
    return this.showValidationErrors && !this.proof;
  }
  submit() {
    this.showValidationErrors = true;
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.proof) {
      this.error = 'Preencha corretamente todos os campos obrigatórios.';
      return;
    }
    this.sending = true;
    this.error = '';
    const data = new FormData();
    Object.entries(this.form.value).forEach(([key, value]) => {
      if (key !== 'firstName' && key !== 'lastName') data.append(key, value || '');
    });
    data.append('name', `${this.form.value.firstName} ${this.form.value.lastName}`.trim());
    data.append('lotId', this.selected.id);
    data.append('proof', this.proof);
    this.api.register(data, crypto.randomUUID()).subscribe({
      next: (result) => {
        this.success = result;
        this.sending = false;
      },
      error: (response) => {
        this.error =
          response.error?.message || 'Não foi possível enviar o comprovante. Tente novamente.';
        this.sending = false;
      },
    });
  }
}
